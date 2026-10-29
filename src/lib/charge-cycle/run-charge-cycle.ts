import type { Logger } from 'pino';
import type { ChargeCycle } from '@/lib/charge-cycle/charge-cycle';
import { chargeOne, type ChargeOneDeps } from '@/lib/charge-cycle/charge-one';
import { deferCycle } from '@/lib/charge-cycle/defer-cycle';
import { CYCLE_RESULT, type CycleResult } from '@/lib/charge-cycle/cycle-result';
import type { CronSummary } from '@/lib/cron/cron-summary';

const PROCESSED: readonly CycleResult[] = [CYCLE_RESULT.CHARGED, CYCLE_RESULT.CANCELED];

export type RunChargeCycleDeps = ChargeOneDeps & { batchLimit: number; logger: Pick<Logger, 'error'> };

export const runChargeCycle = async (
  cycle: ChargeCycle,
  { db, providerFor, batchLimit, logger }: RunChargeCycleDeps,
  now: Date,
): Promise<CronSummary> => {
  const due = await cycle.findDue(db, now, batchLimit);
  const results: CycleResult[] = [];
  for (const charge of due) {
    try {
      results.push(await chargeOne(cycle, { db, providerFor }, charge, now));
    } catch (error) {
      logger.error({ err: error, subscriptionId: charge.subscriptionId }, 'charge cycle failed');
      await deferCycle(db, charge.subscriptionId, now);
      results.push(CYCLE_RESULT.FAILED);
    }
  }
  return {
    processed: results.filter((result) => PROCESSED.includes(result)).length,
    failed: results.filter((result) => result === CYCLE_RESULT.FAILED).length,
  };
};
