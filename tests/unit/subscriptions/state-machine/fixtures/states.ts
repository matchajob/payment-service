import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export const incomplete: SubscriptionState = { status: SUBSCRIPTION_STATUS.INCOMPLETE };
export const active: SubscriptionState = { status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: false };
export const flagged: SubscriptionState = { status: SUBSCRIPTION_STATUS.ACTIVE, cancelAtPeriodEnd: true };
export const pastDue: SubscriptionState = { status: SUBSCRIPTION_STATUS.PAST_DUE };
export const canceled: SubscriptionState = { status: SUBSCRIPTION_STATUS.CANCELED };

export const STATES: readonly SubscriptionState[] = [incomplete, active, flagged, pastDue, canceled];
