import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { after, HOUR_MS, NOT_FOUND_GRACE_MS } from '@tests/utils/reconcile-times';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';
import { checkoutStarted, FIRST_CHARGE_SUCCEEDED } from '@tests/utils/subscribed-flow';
import { TEST_NOW } from '@tests/utils/test-app';

const AN_HOUR_LATER = after(TEST_NOW, HOUR_MS);
const GRACE_OVER = after(TEST_NOW, NOT_FOUND_GRACE_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };
const FIRST_CHARGE_FAILED = 500;
const REDELIVERY_OK = 200;

describe('charge #1 went through but the call timed out, after a real checkout (ADR 0008, ADR 0017)', () => {
  it('never charges again on the webhook retry, settles by the same dedup key, and renews month 2', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await checkoutStarted(tx);
      flow.provider.scriptChargeThenTimeOut(FIRST_CHARGE_SUCCEEDED);
      expect((await flow.complete()).status).toBe(FIRST_CHARGE_FAILED);
      expect((await flow.complete()).status).toBe(REDELIVERY_OK);
      const firstKey = `${flow.subscriptionId}:${PERIOD_END.toISOString()}:0`;

      expect(await flow.reconcile(AN_HOUR_LATER)).toEqual({ processed: 1, failed: 0, flagged: 0 });

      expect(flow.provider.calls.charge.map(({ dedupKey }) => dedupKey)).toEqual([firstKey]);
      expect(flow.provider.calls.verifyCharge).toEqual([expect.objectContaining({ dedupKey: firstKey })]);
      expect(await chargesOf(tx, flow.subscriptionId)).toEqual([
        expect.objectContaining({
          kind: CHARGE_KIND.FIRST,
          status: CHARGE_STATUS.SUCCEEDED,
          providerChargeRef: FIRST_CHARGE_SUCCEEDED.providerChargeRef,
        }),
      ]);

      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);
      expect(await flow.renew(PERIOD_END)).toEqual({ processed: 1, failed: 0 });
      expect(flow.provider.processedCharges().map(({ request }) => request.dedupKey)).toEqual([
        firstKey,
        `${flow.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:0`,
      ]);
    });
  });
});

describe('charge #1 never reached the provider, after a real checkout (ADR 0017 decision X)', () => {
  it('stays pending and active inside the 24h grace', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await checkoutStarted(tx);
      flow.provider.failCharges();
      await flow.complete();

      expect(await flow.reconcile(AN_HOUR_LATER)).toEqual(NOTHING_DONE);

      expect(await chargesOf(tx, flow.subscriptionId)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.FIRST, status: CHARGE_STATUS.PENDING }),
      ]);
    });
  });

  it('cancels for payment failure once the grace is over, with the not-found reason on the charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await checkoutStarted(tx);
      flow.provider.failCharges();
      await flow.complete();

      await flow.reconcile(GRACE_OVER);

      expect(flow.provider.processedCharges()).toEqual([]);
      expect(await chargesOf(tx, flow.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: NOT_FOUND_REASON }),
      ]);
      expect(await subscriptionRow(tx, flow.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      });
    });
  });
});
