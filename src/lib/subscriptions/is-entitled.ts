import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscriptions/state-machine/subscription-status';

export const isEntitled = (status: SubscriptionStatus, graceEntitlement: boolean, paid: boolean): boolean => {
  if (!paid) return false;
  if (status === SUBSCRIPTION_STATUS.ACTIVE) return true;
  if (status === SUBSCRIPTION_STATUS.PAST_DUE) return graceEntitlement;
  return false;
};
