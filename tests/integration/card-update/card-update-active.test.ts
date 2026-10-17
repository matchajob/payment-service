import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { paymentMethodsOf, paymentMethodUpdatesOf } from '@tests/utils/payment-method-reads';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';

const UPDATED_AT = new Date('2026-02-01T10:00:00.000Z');
const tokenOf = (sessionRef: string) => `token-${sessionRef}`;

describe('card update completed for an active subscription (S1 r13, ADR 0018)', () => {
  it('replaces the card: the old one is marked replaced and the verified token becomes current', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();

      expect((await flow.complete(sessionRef)).status).toBe(200);

      expect(await paymentMethodsOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ paymentMethodId: active.paymentMethodId, replacedAt: UPDATED_AT }),
        expect.objectContaining({
          providerToken: tokenOf(sessionRef),
          captureRef: sessionRef,
          providerConnectionId: active.subscription.providerConnectionId,
          replacedAt: null,
        }),
      ]);
      expect(flow.provider.calls.verifyCheckout).toEqual([sessionRef]);
    });
  });

  it('marks the request completed', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();

      await flow.complete(sessionRef);

      expect(await paymentMethodUpdatesOf(tx, active.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ sessionRef, completedAt: UPDATED_AT }),
      ]);
    });
  });

  it('never charges and emits nothing: a capture never produces a charge row', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);

      await flow.complete(await flow.start());

      expect(flow.provider.calls.charge).toEqual([]);
      expect(await chargesOf(tx, active.subscription.subscriptionId)).toEqual([]);
      expect(await eventsOf(tx, active.subscription.subscriptionId)).toEqual([]);
      expect(await subscriptionRow(tx, active.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
      });
    });
  });

  it('keeps the cancel flag on a subscription set to cancel', async () => {
    await withRollback(testDb(), async (tx) => {
      const flagged = await seedRenewing(tx, { cancelAtPeriodEnd: true });
      const flow = cardUpdateFlow(tx, flagged, UPDATED_AT);

      await flow.complete(await flow.start());

      expect(await subscriptionRow(tx, flagged.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: true,
      });
      expect(await paymentMethodsOf(tx, flagged.subscription.subscriptionId)).toHaveLength(2);
    });
  });

  it('makes the next renewal charge the new card', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT);
      const sessionRef = await flow.start();
      await flow.complete(sessionRef);
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      await renewWith(tx, flow.providers.providerFor)(PERIOD_END);

      expect(flow.provider.calls.charge).toEqual([
        expect.objectContaining({ paymentMethodToken: tokenOf(sessionRef) }),
      ]);
    });
  });
});
