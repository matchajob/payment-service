import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { paymentMethodsOf } from '@tests/utils/payment-method-reads';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';

const RESCUE_DAY = 5;
const RESCUED_AT = dunningDay(RESCUE_DAY);
const NOTHING_DONE = { processed: 0, failed: 0 };

describe('an immediate retry that times out (ADR 0008, ADR 0017)', () => {
  it('stays pending on the new card, keeps the subscription past_due, and blocks the scheduled retry', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx, { nextRetryAt: RESCUED_AT });
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.failCharges();

      expect((await flow.complete(sessionRef)).status).toBe(500);

      const [, newCard] = await paymentMethodsOf(tx, pastDue.subscription.subscriptionId);
      expect(await chargesOf(tx, pastDue.subscription.subscriptionId)).toEqual([
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
      expect(await chargesOf(tx, pastDue.subscription.subscriptionId)).toHaveLength(1);
    });
  });
});
