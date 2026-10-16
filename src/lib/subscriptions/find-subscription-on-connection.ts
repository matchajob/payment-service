import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';

export const findSubscriptionOnConnection = async (
  db: Database,
  providerConnectionId: ProviderConnection['providerConnectionId'],
  subscriptionId: Subscription['subscriptionId'],
): Promise<Subscription | undefined> => {
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.providerConnectionId, providerConnectionId),
        eq(subscriptionsTable.subscriptionId, subscriptionId),
      ),
    )
    .limit(1);
  return subscription;
};
