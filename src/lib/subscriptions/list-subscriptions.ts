import { and, desc, eq, exists, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import { customersTable, type Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { keysetBefore } from '@/lib/pagination/keyset-before';
import { listed, oneMoreThan, UNKNOWN_CURSOR, type ListFilter, type ListResult } from '@/lib/pagination/list-result';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import type { SubscriptionStatus } from '@/lib/subscriptions/state-machine/subscription-status';
import type { Tenant } from '@/lib/tenants/schema';

export type SubscriptionListFilter = ListFilter<Subscription['subscriptionId']> & {
  status?: SubscriptionStatus | undefined;
};
export type SubscriptionListItem = {
  subscription: Subscription;
  customer: Pick<Customer, 'externalRef'>;
  paid: boolean;
};

const cursor = alias(subscriptionsTable, 'cursor');

export const listSubscriptions = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  { limit, startingAfter, status }: SubscriptionListFilter,
): Promise<ListResult<SubscriptionListItem>> => {
  const cursorKeys =
    startingAfter === undefined
      ? undefined
      : db
          .select({ createdAt: cursor.createdAt, subscriptionId: cursor.subscriptionId })
          .from(cursor)
          .where(and(eq(cursor.tenantId, tenantId), eq(cursor.subscriptionId, startingAfter)));
  if (cursorKeys !== undefined && (await cursorKeys).length === 0) return UNKNOWN_CURSOR;
  const paid = exists(
    db
      .select({ chargeId: chargesTable.chargeId })
      .from(chargesTable)
      .where(
        and(
          eq(chargesTable.subscriptionId, subscriptionsTable.subscriptionId),
          eq(chargesTable.status, CHARGE_STATUS.SUCCEEDED),
        ),
      ),
  );
  const rows = await db
    .select({
      subscription: subscriptionsTable,
      customer: { externalRef: customersTable.externalRef },
      paid: sql<boolean>`${paid}`,
    })
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(customersTable.customerId, subscriptionsTable.customerId))
    .where(
      and(
        eq(subscriptionsTable.tenantId, tenantId),
        status === undefined ? undefined : eq(subscriptionsTable.status, status),
        cursorKeys === undefined
          ? undefined
          : keysetBefore([subscriptionsTable.createdAt, subscriptionsTable.subscriptionId], cursorKeys),
      ),
    )
    .orderBy(desc(subscriptionsTable.createdAt), desc(subscriptionsTable.subscriptionId))
    .limit(oneMoreThan(limit));
  return listed(rows, limit);
};
