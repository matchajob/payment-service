import { runChargeCycle, type RunChargeCycleDeps } from '@/lib/charge-cycle/run-charge-cycle';
import type { CronSummary } from '@/lib/cron/cron-summary';
import { renewalCycle } from '@/lib/renewal/renewal-cycle';

export const runRenewal = (deps: RunChargeCycleDeps, now: Date): Promise<CronSummary> =>
  runChargeCycle(renewalCycle, deps, now);
