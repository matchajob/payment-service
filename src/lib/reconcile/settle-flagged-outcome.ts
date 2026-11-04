export const SETTLE_FLAGGED = {
  SETTLED: 'settled',
  SETTLED_NEEDS_REFUND: 'settled_needs_refund',
  RESOLVED: 'resolved',
  NOT_FOUND: 'not_found',
  NOT_SETTLEABLE: 'not_settleable',
} as const;

export type SettleFlaggedOutcome = (typeof SETTLE_FLAGGED)[keyof typeof SETTLE_FLAGGED];
