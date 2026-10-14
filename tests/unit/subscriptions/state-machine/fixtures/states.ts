import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';

export const incomplete: SubscriptionState = { status: 'incomplete' };
export const active: SubscriptionState = { status: 'active', cancelAtPeriodEnd: false };
export const flagged: SubscriptionState = { status: 'active', cancelAtPeriodEnd: true };
export const pastDue: SubscriptionState = { status: 'past_due' };
export const canceled: SubscriptionState = { status: 'canceled' };

export const STATES: readonly SubscriptionState[] = [incomplete, active, flagged, pastDue, canceled];
