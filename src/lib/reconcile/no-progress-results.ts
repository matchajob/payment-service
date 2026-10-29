import { RECONCILE_RESULT, type ReconcileResult } from '@/lib/reconcile/reconcile-result';

export const NO_PROGRESS_RESULTS: readonly ReconcileResult[] = [RECONCILE_RESULT.LEFT, RECONCILE_RESULT.FAILED];
