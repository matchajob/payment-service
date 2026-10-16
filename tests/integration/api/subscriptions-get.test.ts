import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { subscriptionPath } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const NOT_A_UUID = 'acme';

describe('GET /v1/subscriptions/:id (slice 9 D1)', () => {
  it('returns the same snapshot shape the tenant receives in events, entitlement included', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      const res = await testApp(tx).request(subscriptionPath(subscription.subscriptionId), bearer(ctx.apiKey));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(subscriptionResponseSchema.parse(body)).toEqual(body);
      expect(body.data).toEqual({
        subscriptionId: subscription.subscriptionId,
        customerId: subscription.customerId,
        customerExternalRef: expect.any(String),
        planId: ctx.plan.planId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        entitled: true,
        currentPeriodEnd: PERIOD_END.toISOString(),
        cancelAtPeriodEnd: false,
        cancelReason: null,
        canceledAt: null,
      });
    });
  });

  it('says when and why a canceled subscription ended', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx, { status: SUBSCRIPTION_STATUS.CANCELED });
      const res = await testApp(tx).request(subscriptionPath(subscription.subscriptionId), bearer(ctx.apiKey));
      expect((await res.json()).data).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        entitled: false,
        cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        canceledAt: subscription.canceledAt?.toISOString(),
      });
    });
  });

  it("answers 404 for another tenant's subscription, never 403", async () => {
    await withRollback(testDb(), async (tx) => {
      const theirs = await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const res = await testApp(tx).request(
        subscriptionPath(theirs.subscription.subscriptionId),
        bearer(ours.ctx.apiKey),
      );
      expect(res.status).toBe(404);
      expect(problemSchema.parse(await res.json()).status).toBe(404);
    });
  });

  it.each([
    ['an unknown id', randomUUID()],
    ['an id that is not a UUID', NOT_A_UUID],
  ])('answers 404 for %s', async (_, id) => {
    await withRollback(testDb(), async (tx) => {
      const { ctx } = await seedRenewing(tx);
      const res = await testApp(tx).request(subscriptionPath(id), bearer(ctx.apiKey));
      expect(res.status).toBe(404);
    });
  });
});
