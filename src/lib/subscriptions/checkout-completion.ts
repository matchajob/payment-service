export const CHECKOUT_COMPLETION = { HANDLED: 'handled', NOT_COMPLETED: 'not_completed' } as const;

export type CheckoutCompletion = (typeof CHECKOUT_COMPLETION)[keyof typeof CHECKOUT_COMPLETION];
