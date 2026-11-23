import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '@/lib/db';
import type { DeliveryStatus } from '@/lib/outbox/delivery-status';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';
import { keysetBefore } from '@/lib/pagination/keyset-before';
import { listed, oneMoreThan, UNKNOWN_CURSOR, type ListFilter, type ListResult } from '@/lib/pagination/list-result';
import type { Tenant } from '@/lib/tenants/schema';

export type EventListFilter = ListFilter<OutboxEvent['outboxEventId']> & {
  deliveryStatus?: DeliveryStatus | undefined;
};

const cursor = alias(outboxEventsTable, 'cursor');

export const listEvents = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  { limit, startingAfter, deliveryStatus }: EventListFilter,
): Promise<ListResult<OutboxEvent>> => {
  const cursorKeys =
    startingAfter === undefined
      ? undefined
      : db
          .select({ occurredAt: cursor.occurredAt, outboxEventId: cursor.outboxEventId })
          .from(cursor)
          .where(and(eq(cursor.tenantId, tenantId), eq(cursor.outboxEventId, startingAfter)));
  if (cursorKeys !== undefined && (await cursorKeys).length === 0) return UNKNOWN_CURSOR;
  const rows = await db
    .select()
    .from(outboxEventsTable)
    .where(
      and(
        eq(outboxEventsTable.tenantId, tenantId),
        deliveryStatus === undefined ? undefined : eq(outboxEventsTable.deliveryStatus, deliveryStatus),
        cursorKeys === undefined
          ? undefined
          : keysetBefore([outboxEventsTable.occurredAt, outboxEventsTable.outboxEventId], cursorKeys),
      ),
    )
    .orderBy(desc(outboxEventsTable.occurredAt), desc(outboxEventsTable.outboxEventId))
    .limit(oneMoreThan(limit));
  return listed(rows, limit);
};
