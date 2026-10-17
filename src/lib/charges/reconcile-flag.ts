export const RECONCILE_FLAG = {
  STUCK_PENDING: 'stuck_pending',
  REF_NOT_FOUND: 'ref_not_found',
  NO_REFERENCE_LOOKUP: 'no_reference_lookup',
  AMOUNT_MISMATCH: 'amount_mismatch',
  LATE_SUCCESS: 'late_success',
} as const;

export type ReconcileFlag = (typeof RECONCILE_FLAG)[keyof typeof RECONCILE_FLAG];
