import { asc, eq } from 'drizzle-orm';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';

type SubscriptionId = Subscription['subscriptionId'];

export const subscriptionRow = async (db: Database, subscriptionId: SubscriptionId): Promise<Subscription> => {
  const [row] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.subscriptionId, subscriptionId));
  if (row === undefined) throw new Error('subscription not found');
  return row;
};

export const chargesOf = (db: Database, subscriptionId: SubscriptionId) =>
  db.select().from(chargesTable).where(eq(chargesTable.subscriptionId, subscriptionId));

export const eventsOf = (db: Database, subscriptionId: SubscriptionId) =>
  db
    .select()
    .from(outboxEventsTable)
    .where(eq(outboxEventsTable.subscriptionId, subscriptionId))
    .orderBy(asc(outboxEventsTable.sequence));
