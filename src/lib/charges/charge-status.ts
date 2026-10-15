export const CHARGE_STATUS = {
  PENDING: 'pending',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
} as const;

export type ChargeStatus = (typeof CHARGE_STATUS)[keyof typeof CHARGE_STATUS];
