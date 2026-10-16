export const CANCEL_REASON = {
  PAYMENT_FAILURE: 'payment_failure',
  CUSTOMER_REQUEST: 'customer_request',
  ALREADY_SUBSCRIBED: 'already_subscribed',
  CHECKOUT_EXPIRED: 'checkout_expired',
} as const;

export type CancelReason = (typeof CANCEL_REASON)[keyof typeof CANCEL_REASON];
