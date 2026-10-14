export const BILLING_INTERVAL = { MONTH: 'month', YEAR: 'year' } as const;

export type BillingInterval = (typeof BILLING_INTERVAL)[keyof typeof BILLING_INTERVAL];
