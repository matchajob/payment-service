export const STRIPE_INTENT_STATUS = {
  SUCCEEDED: 'succeeded',
  REQUIRES_PAYMENT_METHOD: 'requires_payment_method',
  CANCELED: 'canceled',
  REQUIRES_ACTION: 'requires_action',
  REQUIRES_CONFIRMATION: 'requires_confirmation',
} as const;
