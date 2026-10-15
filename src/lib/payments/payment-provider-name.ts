export const PAYMENT_PROVIDER = { GROW: 'grow' } as const;

export type PaymentProviderName = (typeof PAYMENT_PROVIDER)[keyof typeof PAYMENT_PROVIDER];
