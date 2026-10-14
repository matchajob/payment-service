export const CHECKOUT_MODE = { CHARGE: 'charge', CAPTURE: 'capture' } as const;

export type CheckoutMode = (typeof CHECKOUT_MODE)[keyof typeof CHECKOUT_MODE];