import type { Logger } from 'pino';
import { deferCycle } from '@/lib/charge-cycle/defer-cycle';
import type { CronSummary } from '@/lib/cron/cron-summary';
import { forEachWithinBudget } from '@/lib/cron/for-each-within-budget';
import type { TimeUp } from '@/lib/cron/time-up';
import type { Database } from '@/lib/db';
import { findExpiredCheckouts } from '@/lib/housekeeping/find-expired-checkouts';
import { settleExpiredCheckout } from '@/lib/housekeeping/settle-expired-checkout';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { Subscription } from '@/lib/subscriptions/schema';

export type RunHousekeepingDeps = {
  db: Database;
  providerFor: ProviderFor;
  batchLimit: number;
  timeUp: TimeUp;
  logger: Pick<Logger, 'error' | 'warn'>;
};

export const runHousekeeping = async (
  { db, providerFor, batchLimit, timeUp, logger }: RunHousekeepingDeps,
  now: Date,
): Promise<CronSummary> => {
  const expired = await findExpiredCheckouts(db, now, batchLimit);
  const results: boolean[] = [];
  const failures: Subscription['subscriptionId'][] = [];
  await forEachWithinBudget({ timeUp, logger }, expired, async (checkout) => {
    try {
      results.push(await settleExpiredCheckout({ db, providerFor, logger }, checkout, now));
    } catch (error) {
      logger.error({ err: error, subscriptionId: checkout.subscriptionId }, 'checkout expiration failed');
      failures.push(checkout.subscriptionId);
      await deferCycle(db, checkout.subscriptionId, now);
    }
  });
  return { processed: results.filter(Boolean).length, failed: failures.length };
};
