import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';

export const deferCycle = async (
  db: Database,
  subscriptionId: Subscription['subscriptionId'],
  now: Date,
): Promise<void> => {
  await db
    .update(subscriptionsTable)
    .set({ cycleDeferredAt: now })
    .where(eq(subscriptionsTable.subscriptionId, subscriptionId));
};
