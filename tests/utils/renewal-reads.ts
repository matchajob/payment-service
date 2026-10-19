import { asc, eq } from 'drizzle-orm';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import type { Renewing } from '@tests/utils/renewal-rows';

type SubscriptionId = Subscription['subscriptionId'];

export const subscriptionRow = async (db: Database, subscriptionId: SubscriptionId): Promise<Subscription> => {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.subscriptionId, subscriptionId));
  if (row === undefined) throw new Error('subscription not found');
  return row;
};

export const chargesOf = (db: Database, subscriptionId: SubscriptionId) =>
  db
    .select()
    .from(chargesTable)
    .where(eq(chargesTable.subscriptionId, subscriptionId))
    .orderBy(asc(chargesTable.periodEnd), asc(chargesTable.attempt));

export const chargesAfterHistory = async (
  db: Database,
  { subscription, history }: Pick<Renewing, 'subscription' | 'history'>,
) => {
  const seeded = new Set(history.map(({ chargeId }) => chargeId));
  const charges = await chargesOf(db, subscription.subscriptionId);
  return charges.filter(({ chargeId }) => !seeded.has(chargeId));
};

export const eventsOf = (db: Database, subscriptionId: SubscriptionId) =>
  db
    .select()
    .from(outboxEventsTable)
    .where(eq(outboxEventsTable.subscriptionId, subscriptionId))
    .orderBy(asc(outboxEventsTable.sequence));
