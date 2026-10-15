import type { Subscription } from '@/lib/subscriptions/schema';
import type { SubscriptionState } from '@/lib/subscriptions/state-machine/subscription-state';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export const toState = ({
  status,
  cancelAtPeriodEnd,
}: Pick<Subscription, 'status' | 'cancelAtPeriodEnd'>): SubscriptionState =>
  status === SUBSCRIPTION_STATUS.ACTIVE ? { status, cancelAtPeriodEnd } : { status };
