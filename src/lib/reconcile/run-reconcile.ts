import type { Charge } from '@/lib/charges/schema';
import { deferReconcile } from '@/lib/reconcile/defer-reconcile';
import { findLostCharges } from '@/lib/reconcile/find-lost-charges';
import { NO_PROGRESS_RESULTS } from '@/lib/reconcile/no-progress-results';
import { findUnsettledCharges } from '@/lib/reconcile/find-unsettled-charges';
import { reconcileCharge } from '@/lib/reconcile/reconcile-charge';
import type { ReconcileDeps } from '@/lib/reconcile/reconcile-deps';
import { RECONCILE_RESULT, type ReconcileResult } from '@/lib/reconcile/reconcile-result';
import type { ReconcileSummary } from '@/lib/reconcile/reconcile-summary';
import { sweepLostCharge } from '@/lib/reconcile/sweep-lost-charge';

export type RunReconcileDeps = ReconcileDeps & { batchLimit: number };
type Step = (deps: ReconcileDeps, charge: Charge, now: Date) => Promise<ReconcileResult>;

const countOf = (results: readonly ReconcileResult[], wanted: ReconcileResult): number =>
  results.filter((result) => result === wanted).length;

export const runReconcile = async (deps: RunReconcileDeps, now: Date): Promise<ReconcileSummary> => {
  const unsettled = await findUnsettledCharges(deps.db, now, deps.batchLimit);
  const lost = await findLostCharges(deps.db, now, deps.batchLimit);
  const results: ReconcileResult[] = [];
  const runEach = async (charges: readonly Charge[], step: Step) => {
    for (const charge of charges) {
      const result = await step(deps, charge, now).catch((error: unknown) => {
        deps.logger.error({ err: error, chargeId: charge.chargeId }, 'reconcile failed');
        return RECONCILE_RESULT.FAILED;
      });
      if (NO_PROGRESS_RESULTS.includes(result)) await deferReconcile(deps.db, charge.chargeId, now);
      results.push(result);
    }
  };
  await runEach(unsettled, reconcileCharge);
  await runEach(lost, sweepLostCharge);
  return {
    processed: countOf(results, RECONCILE_RESULT.SETTLED),
    failed: countOf(results, RECONCILE_RESULT.FAILED),
    flagged: countOf(results, RECONCILE_RESULT.FLAGGED),
  };
};
