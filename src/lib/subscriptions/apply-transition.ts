import { eq } from 'drizzle-orm';
import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import type { Outcome, OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import type { Tenant } from '@/lib/tenants/schema';
import { toSnapshot } from '@/lib/subscriptions/to-snapshot';
import { newDelivery } from '@/lib/outbox/new-delivery';

type Accepted = Extract<Outcome, { kind: typeof OUTCOME_KIND.ACCEPTED }>;
export type TransitionChanges = Partial<
  Pick<
    Subscription,
    | 'currentPeriodEnd'
    | 'anchorDay'
    | 'canceledAt'
    | 'cancelReason'
    | 'dunningAttempt'
    | 'dunningStartedAt'
    | 'nextRetryAt'
  >
>;

export type ApplyTransitionInput = {
  subscription: Subscription;
  outcome: Accepted;
  changes: TransitionChanges;
  customer: Pick<Customer, 'externalRef'>;
  tenant: Pick<Tenant, 'graceEntitlement'>;
  occurredAt: Date;
};

export const applyTransition = async (
  tx: Database,
  { subscription, outcome, changes, customer, tenant, occurredAt }: ApplyTransitionInput,
): Promise<Subscription> => {
  const { to, emits } = outcome;
  const [updated] = await tx
    .update(subscriptionsTable)
    .set({
      ...changes,
      status: to.status,
      cancelAtPeriodEnd: 'cancelAtPeriodEnd' in to ? to.cancelAtPeriodEnd : false,
      sequence: subscription.sequence + emits.length,
    })
    .where(eq(subscriptionsTable.subscriptionId, subscription.subscriptionId))
    .returning();
  if (updated === undefined) throw new Error('subscription missing during transition');
  if (emits.length > 0) {
    const snapshot = toSnapshot(updated, customer, tenant);
    await tx.insert(outboxEventsTable).values(
      emits.map((eventType, index) => ({
        tenantId: updated.tenantId,
        subscriptionId: updated.subscriptionId,
        eventType,
        sequence: subscription.sequence + index + 1,
        snapshot,
        occurredAt,
        ...newDelivery(occurredAt),
      })),
    );
  }
  return updated;
};
