export const OUTBOUND_EVENT_TYPE = {
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  CHARGE_SUCCEEDED: 'charge.succeeded',
  CHARGE_FAILED: 'charge.failed',
} as const;

export type OutboundEventType = (typeof OUTBOUND_EVENT_TYPE)[keyof typeof OUTBOUND_EVENT_TYPE];
