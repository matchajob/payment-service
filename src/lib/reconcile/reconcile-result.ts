export const RECONCILE_RESULT = { SETTLED: 'settled', FLAGGED: 'flagged', LEFT: 'left', FAILED: 'failed' } as const;

export type ReconcileResult = (typeof RECONCILE_RESULT)[keyof typeof RECONCILE_RESULT];
