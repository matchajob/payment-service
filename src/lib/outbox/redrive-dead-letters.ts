import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { newDelivery } from '@/lib/outbox/new-delivery';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';

export type RedriveFilter = Pick<OutboxEvent, 'outboxEventId'> | Pick<OutboxEvent, 'tenantId'>;

const scopeOf = (filter: RedriveFilter) =>
  'outboxEventId' in filter
    ? eq(outboxEventsTable.outboxEventId, filter.outboxEventId)
    : eq(outboxEventsTable.tenantId, filter.tenantId);

export const redriveDeadLetters = async (db: Database, filter: RedriveFilter, now: Date): Promise<number> => {
  const redriven = await db
    .update(outboxEventsTable)
    .set({ ...newDelivery(now), lastError: null })
    .where(and(eq(outboxEventsTable.deliveryStatus, DELIVERY_STATUS.DEAD), scopeOf(filter)))
    .returning({ outboxEventId: outboxEventsTable.outboxEventId });
  return redriven.length;
};
