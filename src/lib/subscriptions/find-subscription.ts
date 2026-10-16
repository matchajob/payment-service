import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const findSubscription = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  subscriptionId: Subscription['subscriptionId'],
): Promise<Subscription | undefined> => {
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.tenantId, tenantId), eq(subscriptionsTable.subscriptionId, subscriptionId)))
    .limit(1);
  return subscription;
};
