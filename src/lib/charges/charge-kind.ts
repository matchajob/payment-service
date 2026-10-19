export const CHARGE_KIND = {
  FIRST: 'first',
  RENEWAL: 'renewal',
  RETRY: 'retry',
  IMMEDIATE_RETRY: 'immediate_retry',
} as const;

export type ChargeKind = (typeof CHARGE_KIND)[keyof typeof CHARGE_KIND];
