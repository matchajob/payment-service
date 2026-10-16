import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { REJECTION_REASON } from '@/lib/subscriptions/state-machine/rejection-reason';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, FIRST_RETRY_DAY, seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { cancelPath, postNoBody } from '@tests/utils/subscription-api';
import { TEST_NOW, testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const RETRY_AFTER = 'retry-after';
const INCOMPLETE = { status: SUBSCRIPTION_STATUS.INCOMPLETE, currentPeriodEnd: null, anchorDay: null };

const cancel = async (tx: Database, seed: (db: Database) => ReturnType<typeof seedRenewing>) => {
  const seeded = await seed(tx);
  const res = await testApp(tx).request(cancelPath(seeded.subscription.subscriptionId), postNoBody(seeded.ctx.apiKey));
  return { ...seeded, res };
};

describe('POST /v1/subscriptions/:id/cancel (S1 r4, r8, r12, r15)', () => {
  it('r4: cancels an incomplete subscription at once, with no event', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, res } = await cancel(tx, (db) => seedRenewing(db, INCOMPLETE));
      expect(res.status).toBe(200);
      expect(subscriptionResponseSchema.parse(await res.json()).data).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        canceledAt: TEST_NOW.toISOString(),
        entitled: false,
      });
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('r8: flags an active subscription, which stays entitled until its period end, the effective date', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, res } = await cancel(tx, (db) => seedRenewing(db));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(subscriptionResponseSchema.parse(body)).toEqual(body);
      expect(body.data).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: PERIOD_END.toISOString(),
        entitled: true,
        canceledAt: null,
        cancelReason: null,
      });
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('r8: cancelling a flagged subscription again answers 200 and changes nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, res } = await cancel(tx, (db) => seedRenewing(db, { cancelAtPeriodEnd: true }));
      expect(res.status).toBe(200);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: true,
        sequence: subscription.sequence,
      });
    });
  });

  it('r12: cancels a past_due subscription at once, stops dunning, and emits subscription.canceled', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, res } = await cancel(tx, (db) => seedPastDue(db));
      expect(res.status).toBe(200);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        canceledAt: TEST_NOW,
        nextRetryAt: null,
        dunningStartedAt: null,
      });
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.SUBSCRIPTION_CANCELED]);
      expect(events[0]?.snapshot).toMatchObject({ cancelReason: CANCEL_REASON.CUSTOMER_REQUEST });
    });
  });

  it('r15: answers 409 for a canceled subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const { res } = await cancel(tx, (db) => seedRenewing(db, { status: SUBSCRIPTION_STATUS.CANCELED }));
      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.NOT_ACCEPTED_IN_STATE);
    });
  });

  it('answers 409 for a store-billed subscription, which the store cancels', async () => {
    await withRollback(testDb(), async (tx) => {
      const { res } = await cancel(tx, (db) => seedRenewing(db, { scheduleOwner: SCHEDULE_OWNER.EXTERNAL }));
      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.STORE_MANAGED);
    });
  });

  it("answers 404 for another tenant's subscription and changes nothing", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const res = await testApp(tx).request(
        cancelPath(theirs.subscription.subscriptionId),
        postNoBody(ours.ctx.apiKey),
      );
      expect(res.status).toBe(404);
      expect(await subscriptionRow(tx, theirs.subscription.subscriptionId)).toMatchObject({ cancelAtPeriodEnd: false });
    });
  });

  it('replays the same response for a retried Idempotency-Key (Spec 3)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      const app = testApp(tx);
      const key = randomUUID();
      const first = await app.request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey, key));
      const replay = await app.request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey, key));
      expect(await replay.text()).toBe(await first.text());
    });
  });
});

describe('a cancel while a charge is in flight (slice 9 D3)', () => {
  it('answers 409 with Retry-After and leaves the subscription as it was, so the charge can settle first', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, subscription } = await seedRenewing(tx);
      providers.providerOf(ctx.providerConnectionId).failCharges();
      await renewWith(tx, providers.providerFor)(PERIOD_END);

      const res = await testApp(tx).request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey));

      expect(res.status).toBe(409);
      expect(res.headers.get(RETRY_AFTER)).not.toBeNull();
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: false,
      });
    });
  });

  it('also refuses to cancel a past_due subscription while its retry is in flight', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { ctx, subscription } = await seedPastDue(tx);
      providers.providerOf(ctx.providerConnectionId).failCharges();
      await dunWith(tx, providers.providerFor)(dunningDay(FIRST_RETRY_DAY));

      const res = await testApp(tx).request(cancelPath(subscription.subscriptionId), postNoBody(ctx.apiKey));

      expect(res.status).toBe(409);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
      });
    });
  });
});
