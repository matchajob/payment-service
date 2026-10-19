import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { dunningDay, FIRST_RETRY_DAY, SECOND_RETRY_DAY } from '@tests/utils/dunning-days';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_AFTER_NEXT_END, PERIOD_END } from '@tests/utils/renewal-rows';
import { subscribedThroughCheckout } from '@tests/utils/subscribed-flow';

const TWO_DAYS_LATE = dunningDay(SECOND_RETRY_DAY);

const declinedAtRenewal = async (tx: Database) => {
  const flow = await subscribedThroughCheckout(tx);
  flow.provider.scriptCharge(DECLINED);
  await flow.renew(PERIOD_END);
  return flow;
};

describe('a declined renewal rescued by dunning, after a real checkout (S1 r6, r10, D7)', () => {
  it('schedules retry 1 a day after the decline', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscriptionId } = await declinedAtRenewal(tx);

      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
        nextRetryAt: dunningDay(FIRST_RETRY_DAY),
      });
    });
  });

  it('retries the same period as the next attempt when the cron runs two days late, and rescues', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await declinedAtRenewal(tx);
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect(await flow.dun(TWO_DAYS_LATE)).toEqual({ processed: 1, failed: 0 });

      expect(await chargesOf(tx, flow.subscriptionId)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.FIRST, periodEnd: PERIOD_END, status: CHARGE_STATUS.SUCCEEDED }),
        expect.objectContaining({ kind: CHARGE_KIND.RENEWAL, periodEnd: NEXT_PERIOD_END, attempt: 0 }),
        expect.objectContaining({ kind: CHARGE_KIND.RETRY, periodEnd: NEXT_PERIOD_END, attempt: 1 }),
      ]);
      expect(await subscriptionRow(tx, flow.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
        dunningAttempt: 0,
        nextRetryAt: null,
        dunningStartedAt: null,
      });
    });
  });

  it('renews the following period on the anchor, not counted from the late rescue', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await declinedAtRenewal(tx);
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);
      await flow.dun(TWO_DAYS_LATE);
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect(await flow.renew(NEXT_PERIOD_END)).toEqual({ processed: 1, failed: 0 });

      expect(flow.provider.calls.charge.map(({ dedupKey }) => dedupKey)).toEqual([
        `${flow.subscriptionId}:${PERIOD_END.toISOString()}:0`,
        `${flow.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:0`,
        `${flow.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:1`,
        `${flow.subscriptionId}:${PERIOD_AFTER_NEXT_END.toISOString()}:0`,
      ]);
      expect(await subscriptionRow(tx, flow.subscriptionId)).toMatchObject({ currentPeriodEnd: PERIOD_AFTER_NEXT_END });
    });
  });
});
