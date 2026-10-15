export const LIFECYCLE_EVENT = {
  ALREADY_SUBSCRIBED: 'already_subscribed',
  CHECKOUT_COMPLETED: 'checkout_completed',
  CHECKOUT_EXPIRED: 'checkout_expired',
  CANCEL: 'cancel',
  RESUME: 'resume',
  RENEWAL_DUE: 'renewal_due',
  RENEWAL_SUCCEEDED: 'renewal_succeeded',
  RENEWAL_FAILED: 'renewal_failed',
  RETRY_DUE: 'retry_due',
  RETRY_SUCCEEDED: 'retry_succeeded',
  RETRY_FAILED: 'retry_failed',
  FINAL_RETRY_FAILED: 'final_retry_failed',
  FIRST_CHARGE_SUCCEEDED: 'first_charge_succeeded',
  FIRST_CHARGE_FAILED: 'first_charge_failed',
  PAYMENT_METHOD_UPDATED: 'payment_method_updated',
  IMMEDIATE_RETRY_FAILED: 'immediate_retry_failed',
} as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENT)[keyof typeof LIFECYCLE_EVENT];

export const LIFECYCLE_EVENTS: readonly LifecycleEvent[] = Object.values(LIFECYCLE_EVENT);
