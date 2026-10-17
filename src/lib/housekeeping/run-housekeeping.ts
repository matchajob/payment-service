import type { Logger } from 'pino';
import type { CronSummary } from '@/lib/cron/cron-summary';
import type { Database } from '@/lib/db';
import { expireCheckout } from '@/lib/housekeeping/expire-checkout';
import { findExpiredCheckouts } from '@/lib/housekeeping/find-expired-checkouts';
import type { Subscription } from '@/lib/subscriptions/schema';

export type RunHousekeepingDeps = { db: Database; batchLimit: number; logger: Pick<Logger, 'error'> };

export const runHousekeeping = async (
  { db, batchLimit, logger }: RunHousekeepingDeps,
  now: Date,
): Promise<CronSummary> => {
  const expired = await findExpiredCheckouts(db, now, batchLimit);
  const results: boolean[] = [];
  const failures: Subscription['subscriptionId'][] = [];
  for (const subscriptionId of expired) {
    try {
      results.push(await expireCheckout(db, subscriptionId, now));
    } catch (error) {
      logger.error({ err: error, subscriptionId }, 'checkout expiration failed');
      failures.push(subscriptionId);
    }
  }
  return { processed: results.filter(Boolean).length, failed: failures.length };
};
