import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import type { Subscription } from '@/lib/subscriptions/schema';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import type { Tenant } from '@/lib/tenants/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';

export type CancelAlreadySubscribedInput = {
  subscriptionId: Subscription['subscriptionId'];
  tenant: Tenant;
  customer: Customer;
  now: Date;
};

export const cancelAlreadySubscribed = (db: Database, input: CancelAlreadySubscribedInput): Promise<void> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, input.subscriptionId);
    if (subscription === undefined) return;
    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.ALREADY_SUBSCRIBED,
      transitionContextFor(subscription, input.tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return;
    await applyTransition(tx, {
      subscription,
      outcome,
      changes: { canceledAt: input.now, cancelReason: CANCEL_REASON.ALREADY_SUBSCRIBED },
      customer: input.customer,
      tenant: input.tenant,
      occurredAt: input.now,
    });
  });
