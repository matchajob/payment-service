export const CYCLE_RESULT = { CHARGED: 'charged', CANCELED: 'canceled', SKIPPED: 'skipped', FAILED: 'failed' } as const;

export type CycleResult = (typeof CYCLE_RESULT)[keyof typeof CYCLE_RESULT];
