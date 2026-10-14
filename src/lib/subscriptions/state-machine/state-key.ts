import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export const STATE_KEY = { ...SUBSCRIPTION_STATUS, ACTIVE_FLAGGED: 'active_flagged' } as const;

export type StateKey = (typeof STATE_KEY)[keyof typeof STATE_KEY];

export const stateKey = (state: SubscriptionState): StateKey => {
  if (state.status === SUBSCRIPTION_STATUS.ACTIVE) {
    return state.cancelAtPeriodEnd ? STATE_KEY.ACTIVE_FLAGGED : STATE_KEY.ACTIVE;
  }
  return state.status;
};
