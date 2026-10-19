import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { updatePaymentMethodResponseSchema } from '@/contract/update-payment-method-response';
import type { Database } from '@/lib/db';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { REJECTION_REASON } from '@/lib/subscriptions/state-machine/rejection-reason';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { CARD_UPDATE_RETURN_URL, cardUpdateFlow } from '@tests/utils/card-update-flow';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { FAKE_CHECKOUT_URL } from '@tests/utils/fake-payment-provider';
import { paymentMethodsOf, paymentMethodUpdatesOf } from '@tests/utils/payment-method-reads';
import { postJson } from '@tests/utils/post-json';
import { chargesAfterHistory, chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { updatePaymentMethodPath } from '@tests/utils/subscription-api';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const UPDATED_AT = new Date('2026-02-01T10:00:00.000Z');
const NOT_A_WEB_URL = 'ftp://tenant.test/billing/card-updated';
const INCOMPLETE = { status: SUBSCRIPTION_STATUS.INCOMPLETE, currentPeriodEnd: null, anchorDay: null };

describe('POST /v1/subscriptions/:id/update-payment-method (S1 r13, ADR 0018)', () => {
  it('answers 201 with the checkout URL for an active subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const res = await cardUpdateFlow(tx, active, UPDATED_AT).request();

      expect(res.status).toBe(201);
      expect(updatePaymentMethodResponseSchema.parse(await res.json()).data).toEqual({
        subscriptionId: active.subscription.subscriptionId,
        checkoutUrl: FAKE_CHECKOUT_URL,
      });
    });
  });

  it('starts a capture-mode checkout for the plan amount that references the subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);

      await flow.request();

      expect(flow.provider.calls.startCheckout).toEqual([
        {
          mode: CHECKOUT_MODE.CAPTURE,
          reference: active.subscription.subscriptionId,
          amountMinor: active.ctx.plan.amountMinor,
          currency: active.ctx.plan.currency,
          returnUrl: CARD_UPDATE_RETURN_URL,
        },
      ]);
    });
  });

  it('records the request with its session, not yet completed (ADR 0018 decision 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const sessionRef = await cardUpdateFlow(tx, active, UPDATED_AT).start();

      expect(await paymentMethodUpdatesOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          sessionRef,
          providerConnectionId: active.subscription.providerConnectionId,
          requestedAt: UPDATED_AT,
          completedAt: null,
        }),
      ]);
    });
  });

  it('charges nothing and changes neither the card nor the subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);

      await flow.start();

      expect(flow.provider.calls.charge).toEqual([]);
      expect(await chargesAfterHistory(tx, active)).toEqual([]);
      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ paymentMethodId: active.paymentMethodId, replacedAt: null }),
      ]);
      expect(await subscriptionRow(tx, active.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        sequence: active.subscription.sequence,
      });
      expect(await eventsOf(tx, active.subscription.subscriptionId)).toEqual([]);
    });
  });

  it.each([
    ['past_due', (db: Database) => seedPastDue(db)],
    ['set to cancel', (db: Database) => seedRenewing(db, { cancelAtPeriodEnd: true })],
  ])('answers 201 for a subscription that is %s', async (_, seed) => {
    await withRollback(testDb(), async (tx) => {
      const res = await cardUpdateFlow(tx, await seed(tx), UPDATED_AT).request();
      expect(res.status).toBe(201);
    });
  });

  it.each([
    ['incomplete, whose own checkout is the way in', (db: Database) => seedRenewing(db, INCOMPLETE)],
    ['canceled', (db: Database) => seedRenewing(db, { status: SUBSCRIPTION_STATUS.CANCELED })],
  ])('answers 409 for a subscription that is %s, and starts no checkout', async (_, seed) => {
    await withRollback(testDb(), async (tx) => {
      const flow = cardUpdateFlow(tx, await seed(tx), UPDATED_AT);
      const res = await flow.request();

      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.NOT_ACCEPTED_IN_STATE);
      expect(flow.provider.calls.startCheckout).toEqual([]);
    });
  });

  it('answers 409 for a store-billed subscription, whose card the store holds', async () => {
    await withRollback(testDb(), async (tx) => {
      const storeBilled = await seedRenewing(tx, { scheduleOwner: SCHEDULE_OWNER.EXTERNAL });
      const res = await cardUpdateFlow(tx, storeBilled, UPDATED_AT).request();

      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.STORE_MANAGED);
    });
  });

  it("answers 404 for another tenant's subscription and starts no checkout", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const flow = cardUpdateFlow(tx, { ...ours, subscription: theirs.subscription }, UPDATED_AT);

      expect((await flow.request()).status).toBe(404);
      expect(flow.provider.calls.startCheckout).toEqual([]);
    });
  });

  it('answers 404 for an unknown subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const res = await flow.app.request(
        updatePaymentMethodPath(randomUUID()),
        postJson(active.ctx.apiKey, { returnUrl: CARD_UPDATE_RETURN_URL }),
      );
      expect(res.status).toBe(404);
    });
  });

  it('answers 400 for a return URL that is not http(s)', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      expect((await cardUpdateFlow(tx, active, UPDATED_AT).request(NOT_A_WEB_URL)).status).toBe(400);
    });
  });

  it("captures on the subscription's pinned connection after its tenant switched (ADR 0018 decision 5)", async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const replacement = await seedConnection(tx, active.ctx.organizationId);
      await tx
        .update(tenantsTable)
        .set({ providerConnectionId: replacement.providerConnectionId })
        .where(eq(tenantsTable.tenantId, active.ctx.tenantId));
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);

      await flow.request();

      expect(flow.provider.calls.startCheckout).toHaveLength(1);
      expect(flow.providers.providerOf(replacement.providerConnectionId).calls.startCheckout).toEqual([]);
    });
  });

  it('starts one checkout when a request is retried with the same idempotency key (ADR 0006)', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const key = randomUUID();
      const sendWithKey = () =>
        flow.app.request(
          updatePaymentMethodPath(active.subscription.subscriptionId),
          postJson(active.ctx.apiKey, { returnUrl: CARD_UPDATE_RETURN_URL }, key),
        );

      const first = await sendWithKey();
      const replay = await sendWithKey();

      expect(replay.status).toBe(first.status);
      expect(await replay.text()).toBe(await first.text());
      expect(flow.provider.calls.startCheckout).toHaveLength(1);
      expect(await paymentMethodUpdatesOf(tx, active.subscription.subscriptionId)).toHaveLength(1);
    });
  });
});
