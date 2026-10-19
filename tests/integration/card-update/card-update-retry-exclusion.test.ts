import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { dunningDay, FINAL_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { paymentMethodsOf } from '@tests/utils/payment-method-reads';
import { RETRY_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingRetry } from '@tests/utils/pending-charge-rows';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, chargesOf } from '@tests/utils/renewal-reads';

const RESCUE_DAY = 5;
const RESCUED_AT = dunningDay(RESCUE_DAY);
const NOTHING_DONE = { processed: 0, failed: 0 };

describe('the immediate retry and the scheduled retry cannot both fire (S1 r14, ADR 0018 decision 4)', () => {
  it('runs no immediate retry while a scheduled retry is in flight, but still replaces the card', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRetry(tx);
      const flow = cardUpdateFlow(tx, pending, after(RETRY_ATTEMPTED_AT, HOUR_MS));

      expect((await flow.complete(await flow.start())).status).toBe(200);

      expect(flow.provider.calls.charge).toEqual([]);
      expect(await chargesAfterHistory(tx, pending)).toEqual([
        expect.objectContaining({ chargeId: pending.charge.chargeId, status: CHARGE_STATUS.PENDING }),
      ]);
      expect(await paymentMethodsOf(tx, pending.subscription.subscriptionId)).toHaveLength(2);
    });
  });

  it('supersedes a scheduled retry that was already due: after a failed rescue, that run charges nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx, { nextRetryAt: RESCUED_AT });
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(DECLINED);
      await flow.complete(sessionRef);

      expect(await dunWith(tx, flow.providers.providerFor)(RESCUED_AT)).toEqual(NOTHING_DONE);

      expect(flow.provider.calls.charge).toHaveLength(1);
    });
  });

  it('leaves nothing for the scheduled retry after a successful rescue', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedPastDue(tx, { nextRetryAt: dunningDay(FINAL_RETRY_DAY) });
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);
      await flow.complete(sessionRef);

      expect(await dunWith(tx, flow.providers.providerFor)(dunningDay(FINAL_RETRY_DAY))).toEqual(NOTHING_DONE);

      expect(flow.provider.calls.charge).toHaveLength(1);
    });
  });
});
