import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { dunningDay, FINAL_RETRY_DAY, FIRST_RETRY_DAY, SECOND_RETRY_DAY } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';

const ONE_MS = 1;
const BETWEEN_RETRIES_DAY = 2;
const DEFAULT_ATTEMPTS = 4;
const RENEWAL_THEN_THREE_RETRIES = [0, 1, 2, 3];
const ONE_DECLINE = 1;
const CUSTOM_SCHEDULE = [2];
const CUSTOM_RETRY_DAY = 2;
const CUSTOM_ATTEMPTS = 2;
const LONGER_SCHEDULE = [4, 8, 12];
const NOTHING_DONE = { processed: 0, failed: 0 };

const declineEverything = async (tx: Database, attempts: number) => {
  const providers = fakeProviderFactory();
  const renewing = await seedRenewing(tx);
  const provider = providers.providerOf(renewing.ctx.providerConnectionId);
  Array.from({ length: attempts }).forEach(() => provider.scriptCharge(DECLINED));
  const setSchedule = (dunningScheduleDays: number[]) =>
    tx.update(tenantsTable).set({ dunningScheduleDays }).where(eq(tenantsTable.tenantId, renewing.ctx.tenantId));
  return {
    ...renewing,
    provider,
    setSchedule,
    renew: renewWith(tx, providers.providerFor),
    dun: dunWith(tx, providers.providerFor),
  };
};

const attemptsOf = (dedupKeys: string[]) => dedupKeys.map((key) => Number(key.split(':').at(-1)));

describe('the default schedule end to end: +1d, +3d, +7d from the failed renewal (Spec 2, D3)', () => {
  it('retries on days 1, 3 and 7, never in between, and cancels after the third retry fails', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew, dun } = await declineEverything(tx, DEFAULT_ATTEMPTS);

      await renew(PERIOD_END);
      expect(await dun(new Date(dunningDay(FIRST_RETRY_DAY).getTime() - ONE_MS))).toEqual(NOTHING_DONE);
      await dun(dunningDay(FIRST_RETRY_DAY));
      expect(await dun(dunningDay(BETWEEN_RETRIES_DAY))).toEqual(NOTHING_DONE);
      await dun(dunningDay(SECOND_RETRY_DAY));
      await dun(dunningDay(FINAL_RETRY_DAY));

      expect(attemptsOf(provider.calls.charge.map(({ dedupKey }) => dedupKey))).toEqual(RENEWAL_THEN_THREE_RETRIES);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      });
    });
  });
});

describe("a tenant's own schedule (D3)", () => {
  it('retries once at +2d for a [2] schedule, then cancels', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, setSchedule, renew, dun } = await declineEverything(tx, CUSTOM_ATTEMPTS);
      await setSchedule(CUSTOM_SCHEDULE);

      await renew(PERIOD_END);
      await dun(dunningDay(CUSTOM_RETRY_DAY));

      expect(provider.calls.charge).toHaveLength(CUSTOM_ATTEMPTS);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
      });
    });
  });

  it('keeps a retry already scheduled when the tenant changes its schedule afterwards (ADR 0014)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, renew, setSchedule } = await declineEverything(tx, ONE_DECLINE);
      await renew(PERIOD_END);
      await setSchedule(LONGER_SCHEDULE);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        nextRetryAt: dunningDay(FIRST_RETRY_DAY),
      });
    });
  });
});
