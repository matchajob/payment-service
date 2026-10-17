export const SETTLE_FLAGGED = { SETTLED: 'settled', NOT_FOUND: 'not_found', NOT_SETTLEABLE: 'not_settleable' } as const;

export type SettleFlaggedOutcome = (typeof SETTLE_FLAGGED)[keyof typeof SETTLE_FLAGGED];
