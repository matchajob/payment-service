import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, FINAL_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { paymentMethodsOf } from '@tests/utils/payment-method-reads';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { chargesAfterHistory, chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';

const RESCUE_DAY = 5;
const RESCUED_AT = dunningDay(RESCUE_DAY);
const NOTHING_DONE = { processed: 0, failed: 0 };
const RETRIES_BEFORE_LAST_SLOT = 2;
const AN_HOUR_AFTER_RESCUE = after(RESCUED_AT, HOUR_MS);

describe('an immediate retry that times out (ADR 0008, ADR 0017)', () => {
  it('stays pending on the new card, keeps the subscription past_due, and blocks the scheduled retry', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx, { nextRetryAt: RESCUED_AT });
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.failCharges();

      expect((await flow.complete(sessionRef)).status).toBe(500);

      const [, newCard] = await paymentMethodsOf(tx, pastDue.subscription.subscriptionId);
      expect(await chargesAfterHistory(tx, pastDue)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, paymentMethodId: newCard?.paymentMethodId }),
      ]);
      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
      });
      expect(await dunWith(tx, flow.providers.providerFor)(RESCUED_AT)).toEqual(NOTHING_DONE);
    });
  });

  it('never charges again when the provider redelivers the webhook', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.failCharges();
      await flow.complete(sessionRef);

      expect((await flow.complete(sessionRef)).status).toBe(200);

      expect(flow.provider.calls.charge).toHaveLength(1);
      expect(await chargesAfterHistory(tx, pastDue)).toHaveLength(1);
    });
  });

  it('stays past_due when reconcile later learns it was declined, even on the last slot (H2 in code-review-1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx, {
        dunningAttempt: RETRIES_BEFORE_LAST_SLOT,
        nextRetryAt: dunningDay(FINAL_RETRY_DAY),
      });
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptChargeThenTimeOut(DECLINED);
      await flow.complete(sessionRef);

      expect(await reconcileWith(tx, flow.providers.providerFor)(AN_HOUR_AFTER_RESCUE)).toEqual({
        processed: 1,
        failed: 0,
        flagged: 0,
      });

      expect(await chargesAfterHistory(tx, pastDue)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.IMMEDIATE_RETRY, status: CHARGE_STATUS.FAILED }),
      ]);
      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        canceledAt: null,
        dunningStartedAt: AN_HOUR_AFTER_RESCUE,
        nextRetryAt: after(AN_HOUR_AFTER_RESCUE, DAY_MS),
      });
    });
  });
});
