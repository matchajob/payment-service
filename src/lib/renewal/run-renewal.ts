import type { Logger } from 'pino';
import type { CronSummary } from '@/lib/cron/cron-summary';
import { findDueRenewals } from '@/lib/renewal/find-due-renewals';
import { renewOne, type RenewOneDeps } from '@/lib/renewal/renew-one';
import { RENEWAL_RESULT, type RenewalResult } from '@/lib/renewal/renewal-result';

const PROCESSED: readonly RenewalResult[] = [RENEWAL_RESULT.RENEWED, RENEWAL_RESULT.CANCELED];

export type RunRenewalDeps = RenewOneDeps & { batchLimit: number; logger: Pick<Logger, 'error'> };

export const runRenewal = async (
  { db, providerFor, batchLimit, logger }: RunRenewalDeps,
  now: Date,
): Promise<CronSummary> => {
  const due = await findDueRenewals(db, now, batchLimit);
  const results: RenewalResult[] = [];
  for (const renewal of due) {
    try {
      results.push(await renewOne({ db, providerFor }, renewal, now));
    } catch (error) {
      logger.error({ err: error, subscriptionId: renewal.subscriptionId }, 'renewal failed');
      results.push(RENEWAL_RESULT.FAILED);
    }
  }
  return {
    processed: results.filter((result) => PROCESSED.includes(result)).length,
    failed: results.filter((result) => result === RENEWAL_RESULT.FAILED).length,
  };
};
