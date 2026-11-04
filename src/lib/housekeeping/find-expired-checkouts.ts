import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { effectiveDueOrder } from '@/lib/effective-due-order';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';

export type ExpiredCheckout = Pick<Subscription, 'subscriptionId' | 'providerConnectionId' | 'checkoutSessionRef'>;

export const findExpiredCheckouts = (db: Database, now: Date, limit: number): Promise<ExpiredCheckout[]> =>
  db
    .select({
      subscriptionId: subscriptionsTable.subscriptionId,
      providerConnectionId: subscriptionsTable.providerConnectionId,
      checkoutSessionRef: subscriptionsTable.checkoutSessionRef,
    })
    .from(subscriptionsTable)
    .innerJoin(tenantsTable, eq(tenantsTable.tenantId, subscriptionsTable.tenantId))
    .where(
      and(
        eq(subscriptionsTable.status, SUBSCRIPTION_STATUS.INCOMPLETE),
        sql`${subscriptionsTable.createdAt} + make_interval(hours => ${tenantsTable.checkoutTtlHours}) <= ${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(effectiveDueOrder(subscriptionsTable.createdAt, subscriptionsTable.cycleDeferredAt))
    .limit(limit);
