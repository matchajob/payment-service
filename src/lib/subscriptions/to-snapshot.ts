import type { SubscriptionSnapshot } from '@/contract/subscription-snapshot';
import type { Customer } from '@/lib/customers/schema';
import { isEntitled } from '@/lib/subscriptions/is-entitled';
import type { Subscription } from '@/lib/subscriptions/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const toSnapshot = (
  subscription: Subscription,
  { externalRef }: Pick<Customer, 'externalRef'>,
  { graceEntitlement }: Pick<Tenant, 'graceEntitlement'>,
): SubscriptionSnapshot => ({
  subscriptionId: subscription.subscriptionId,
  customerId: subscription.customerId,
  customerExternalRef: externalRef,
  planId: subscription.planId,
  status: subscription.status,
  entitled: isEntitled(subscription.status, graceEntitlement),
  currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
  cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  cancelReason: subscription.cancelReason,
});
