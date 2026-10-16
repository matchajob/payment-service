import type { Database } from '@/lib/db';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import type { SubscriptionCommandInput } from '@/lib/subscriptions/cancel-subscription';
import { COMMAND_RESULT, type CommandResult } from '@/lib/subscriptions/command-result';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { withTenantSubscription } from '@/lib/subscriptions/with-tenant-subscription';

export const resumeSubscription = (db: Database, { tenant, subscriptionId, now }: SubscriptionCommandInput) =>
  withTenantSubscription(db, tenant, subscriptionId, async (tx, subscription, customer): Promise<CommandResult> => {
    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE && !subscription.cancelAtPeriodEnd)
      return { kind: COMMAND_RESULT.DONE, subscription, customer };
    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.RESUME,
      transitionContextFor(subscription, tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: COMMAND_RESULT.REJECTED, reason: outcome.reason };
    const updated = await applyTransition(tx, {
      subscription,
      outcome,
      changes: {},
      customer,
      tenant,
      occurredAt: now,
    });
    return { kind: COMMAND_RESULT.DONE, subscription: updated, customer };
  });
