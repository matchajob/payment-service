import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';

export type StateKey = 'incomplete' | 'active' | 'active_flagged' | 'past_due' | 'canceled';

export const stateKey = (state: SubscriptionState): StateKey => {
    if (state.status === 'active') return state.cancelAtPeriodEnd ? 'active_flagged' : 'active';
    return state.status;
};