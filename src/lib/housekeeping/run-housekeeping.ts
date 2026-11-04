import type { Logger } from 'pino';
import { deferCycle } from '@/lib/charge-cycle/defer-cycle';
import type { CronSummary } from '@/lib/cron/cron-summary';
import type { Database } from '@/lib/db';
import { findExpiredCheckouts } from '@/lib/housekeeping/find-expired-checkouts';
import { settleExpiredCheckout } from '@/lib/housekeeping/settle-expired-checkout';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { Subscription } from '@/lib/subscriptions/schema';

export type RunHousekeepingDeps = {
  db: Database;
  providerFor: ProviderFor;
  batchLimit: number;
  logger: Pick<Logger, 'error'>;
};

export const runHousekeeping = async (
  { db, providerFor, batchLimit, logger }: RunHousekeepingDeps,
  now: Date,
): Promise<CronSummary> => {
  const expired = await findExpiredCheckouts(db, now, batchLimit);
  const results: boolean[] = [];
  const failures: Subscription['subscriptionId'][] = [];
  for (const checkout of expired) {
    try {
      results.push(await settleExpiredCheckout({ db, providerFor }, checkout, now));
    } catch (error) {
      logger.error({ err: error, subscriptionId: checkout.subscriptionId }, 'checkout expiration failed');
      failures.push(checkout.subscriptionId);
      await deferCycle(db, checkout.subscriptionId, now);
    }
  }
  return { processed: results.filter(Boolean).length, failed: failures.length };
};
