import { hasPendingCharge } from '@/lib/charges/has-pending-charge';
import type { Database } from '@/lib/db';
import { applyTransition, type TransitionChanges } from '@/lib/subscriptions/apply-transition';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { COMMAND_RESULT, type CommandResult } from '@/lib/subscriptions/command-result';
import type { Subscription } from '@/lib/subscriptions/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { withTenantSubscription } from '@/lib/subscriptions/with-tenant-subscription';
import type { Tenant } from '@/lib/tenants/schema';

export type SubscriptionCommandInput = { tenant: Tenant; subscriptionId: Subscription['subscriptionId']; now: Date };

const canceledNow = (now: Date): TransitionChanges => ({
  canceledAt: now,
  cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
  nextRetryAt: null,
  dunningStartedAt: null,
});

export const cancelSubscription = (db: Database, { tenant, subscriptionId, now }: SubscriptionCommandInput) =>
  withTenantSubscription(db, tenant, subscriptionId, async (tx, subscription, customer): Promise<CommandResult> => {
    if (await hasPendingCharge(tx, subscriptionId)) return { kind: COMMAND_RESULT.CHARGE_IN_FLIGHT };
    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.CANCEL,
      transitionContextFor(subscription, tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: COMMAND_RESULT.REJECTED, reason: outcome.reason };
    const updated = await applyTransition(tx, {
      subscription,
      outcome,
      changes: outcome.to.status === SUBSCRIPTION_STATUS.CANCELED ? canceledNow(now) : {},
      customer,
      tenant,
      occurredAt: now,
    });
    return { kind: COMMAND_RESULT.DONE, subscription: updated, customer };
  });
