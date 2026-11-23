import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const findEvent = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  outboxEventId: OutboxEvent['outboxEventId'],
): Promise<OutboxEvent | undefined> => {
  const [event] = await db
    .select()
    .from(outboxEventsTable)
    .where(and(eq(outboxEventsTable.tenantId, tenantId), eq(outboxEventsTable.outboxEventId, outboxEventId)));
  return event;
};
