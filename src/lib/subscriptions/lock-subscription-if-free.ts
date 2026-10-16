import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';

export const lockSubscriptionIfFree = async (
  tx: Database,
  subscriptionId: Subscription['subscriptionId'],
): Promise<Subscription | undefined> => {
  const [subscription] = await tx
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.subscriptionId, subscriptionId))
    .for('update', { skipLocked: true });
  return subscription;
};
