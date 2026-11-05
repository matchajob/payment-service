export const PLAN_FLAG = {
  PLAN_NAME: 'plan-name',
  AMOUNT_MINOR: 'amount-minor',
  CURRENCY: 'currency',
  INTERVAL: 'interval',
} as const;

export type PlanFlag = (typeof PLAN_FLAG)[keyof typeof PLAN_FLAG];
