export const LIFECYCLE_EVENTS = [
  'checkout_completed',
  'checkout_expired',
  'cancel',
  'resume',
  'renewal_due',
  'renewal_succeeded',
  'renewal_failed',
  'retry_succeeded',
  'retry_failed',
  'final_retry_failed',
  'payment_method_updated',
  'immediate_retry_failed',
] as const;

export type LifecycleEvent = (typeof LIFECYCLE_EVENTS)[number];