import { describe, expect, it } from 'vitest';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { bearer } from '@tests/utils/bearer';
import { insertCycleCharge, type ChargeOverrides } from '@tests/utils/cycle-charge-insert';
import { testDb, withRollback } from '@tests/utils/db';
import { FIRST_CHARGE } from '@tests/utils/pending-charge-shapes';
import { ACTIVATED_AT, seedAwaitingFirstCharge } from '@tests/utils/renewal-rows';
import { subscriptionPath } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';

const pendingFirstCharges: [string, ChargeOverrides][] = [
  ['still pending', {}],
  ['flagged for a human', { reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: ACTIVATED_AT }],
];

describe('GET /v1/subscriptions/:id before charge #1 succeeds (Spec 1 "active = paid through", code-review-1 M6)', () => {
  it.each(pendingFirstCharges)('is active but not entitled while charge #1 is %s', async (_, overrides) => {
    await withRollback(testDb(), async (tx) => {
      const awaiting = await seedAwaitingFirstCharge(tx);
      await insertCycleCharge(tx, awaiting, FIRST_CHARGE, overrides);
      const res = await testApp(tx).request(
        subscriptionPath(awaiting.subscription.subscriptionId),
        bearer(awaiting.ctx.apiKey),
      );
      expect(subscriptionResponseSchema.parse(await res.json()).data).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        entitled: false,
      });
    });
  });
});
