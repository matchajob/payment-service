import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { lockSubscriptionIfFree } from '@/lib/subscriptions/lock-subscription-if-free';
import type { Subscription } from '@/lib/subscriptions/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { findTenant } from '@/lib/tenants/find-tenant';

const MISSING_PARENTS = 'expiring subscription references a missing tenant or customer';

export const expireCheckout = (
  db: Database,
  subscriptionId: Subscription['subscriptionId'],
  now: Date,
): Promise<boolean> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscriptionIfFree(tx, subscriptionId);
    if (subscription?.status !== SUBSCRIPTION_STATUS.INCOMPLETE) return false;
    const tenant = await findTenant(tx, subscription.tenantId);
    const customer = await findCustomer(tx, subscription.tenantId, subscription.customerId);
    if (tenant === undefined || customer === undefined) throw new Error(MISSING_PARENTS);

    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.CHECKOUT_EXPIRED,
      transitionContextFor(subscription, tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return false;
    await applyTransition(tx, {
      subscription,
      outcome,
      changes: { canceledAt: now, cancelReason: CANCEL_REASON.CHECKOUT_EXPIRED },
      customer,
      tenant,
      occurredAt: now,
    });
    return true;
  });
