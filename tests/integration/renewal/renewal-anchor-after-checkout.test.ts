import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { testDb, withRollback } from '@tests/utils/db';
import { YEARLY } from '@tests/utils/plan-fixtures';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { subscribedThroughCheckout, type SubscribedFlow } from '@tests/utils/subscribed-flow';

type SubscriptionId = SubscribedFlow['subscriptionId'];

const LAST_DAY_ANCHOR = 31;
const JAN_31 = new Date('2026-01-31T10:00:00.000Z');
const FEB_28 = new Date('2026-02-28T10:00:00.000Z');
const MAR_31 = new Date('2026-03-31T10:00:00.000Z');
const APR_30 = new Date('2026-04-30T10:00:00.000Z');

const LEAP_DAY_ANCHOR = 29;
const LEAP_DAY_2028 = new Date('2028-02-29T10:00:00.000Z');
const FEB_28_2029 = new Date('2029-02-28T10:00:00.000Z');
const FEB_28_2030 = new Date('2030-02-28T10:00:00.000Z');
const FEB_28_2031 = new Date('2031-02-28T10:00:00.000Z');
const LEAP_DAY_2032 = new Date('2032-02-29T10:00:00.000Z');

const renewEachPeriod = async (flow: SubscribedFlow, ends: Date[]) => {
  for (const end of ends) {
    flow.provider.scriptCharge(RENEWAL_SUCCEEDED);
    expect(await flow.renew(end)).toEqual({ processed: 1, failed: 0 });
  }
};

const dedupKeysOf = (flow: SubscribedFlow) => flow.provider.calls.charge.map(({ dedupKey }) => dedupKey);

const keysFor = (subscriptionId: SubscriptionId, ends: Date[]) =>
  ends.map((end) => `${subscriptionId}:${end.toISOString()}:0`);

const anchorOf = async (tx: Database, subscriptionId: SubscriptionId) =>
  (await subscriptionRow(tx, subscriptionId)).anchorDay;

describe('the anchor day holds across renewals after a real checkout (Spec 2, D7)', () => {
  it('activated on the 31st: clamps to the 28th in February and returns to the 31st in March', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await subscribedThroughCheckout(tx, { activatedAt: JAN_31 });

      await renewEachPeriod(flow, [FEB_28, MAR_31]);

      expect(dedupKeysOf(flow)).toEqual(keysFor(flow.subscriptionId, [FEB_28, MAR_31, APR_30]));
      expect(await subscriptionRow(tx, flow.subscriptionId)).toMatchObject({ currentPeriodEnd: APR_30 });
      expect(await anchorOf(tx, flow.subscriptionId)).toBe(LAST_DAY_ANCHOR);
    });
  });

  it('a yearly plan activated on Feb 29: renews on Feb 28 and lands on Feb 29 again in the next leap year', async () => {
    await withRollback(testDb(), async (tx) => {
      const flow = await subscribedThroughCheckout(tx, { activatedAt: LEAP_DAY_2028, plan: YEARLY });

      await renewEachPeriod(flow, [FEB_28_2029, FEB_28_2030, FEB_28_2031]);

      expect(dedupKeysOf(flow)).toEqual(
        keysFor(flow.subscriptionId, [FEB_28_2029, FEB_28_2030, FEB_28_2031, LEAP_DAY_2032]),
      );
      expect(new Set(flow.provider.calls.charge.map(({ amountMinor }) => amountMinor))).toEqual(
        new Set([YEARLY.amountMinor]),
      );
      expect(await subscriptionRow(tx, flow.subscriptionId)).toMatchObject({ currentPeriodEnd: LEAP_DAY_2032 });
      expect(await anchorOf(tx, flow.subscriptionId)).toBe(LEAP_DAY_ANCHOR);
    });
  });
});
