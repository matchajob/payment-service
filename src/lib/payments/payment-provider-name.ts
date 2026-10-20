export const PAYMENT_PROVIDER = { GROW: 'grow', STRIPE: 'stripe' } as const;

export type PaymentProviderName = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];
