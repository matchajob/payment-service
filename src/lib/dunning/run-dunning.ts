import { runChargeCycle, type RunChargeCycleDeps } from '@/lib/charge-cycle/run-charge-cycle';
import type { CronSummary } from '@/lib/cron/cron-summary';
import { dunningCycle } from '@/lib/dunning/dunning-cycle';

export const runDunning = (deps: RunChargeCycleDeps, now: Date): Promise<CronSummary> =>
  runChargeCycle(dunningCycle, deps, now);
