import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

type Status = typeof SUBSCRIPTION_STATUS;

export type SubscriptionState =
  | { status: Status['INCOMPLETE'] }
  | { status: Status['ACTIVE']; cancelAtPeriodEnd: boolean }
  | { status: Status['PAST_DUE'] }
  | { status: Status['CANCELED'] };

export const ACTIVE = { status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: false } satisfies SubscriptionState;
export const ACTIVE_FLAGGED = { status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: true } satisfies SubscriptionState;
export const PAST_DUE = { status: SUBSCRIPTION_STATUS.PAST_DUE } satisfies SubscriptionState;
export const CANCELED = { status: SUBSCRIPTION_STATUS.CANCELED } satisfies SubscriptionState;
