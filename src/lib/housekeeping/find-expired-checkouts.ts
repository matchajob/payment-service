import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';

export const findExpiredCheckouts = async (
  db: Database,
  now: Date,
  limit: number,
): Promise<Subscription['subscriptionId'][]> => {
  const rows = await db
    .select({ subscriptionId: subscriptionsTable.subscriptionId })
    .from(subscriptionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.tenantId, subscriptionsTable.tenantId))
    .where(
      and(
        eq(subscriptionsTable.status, SUBSCRIPTION_STATUS.INCOMPLETE),
        sql`${subscriptionsTable.createdAt} + make_interval(hours => ${tenantsTable.checkoutTtlHours}) <= ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(asc(subscriptionsTable.createdAt))
    .limit(limit);
  return rows.map(({ subscriptionId }) => subscriptionId);
};
