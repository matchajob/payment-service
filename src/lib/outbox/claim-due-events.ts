import { and, asc, eq, inArray, lt, lte, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { DRAIN_BATCH_SIZE, LEASE_MS } from '@/lib/outbox/delivery-timing';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';

export const claimDueEvents = async (db: Database, now: Date): Promise<OutboxEvent[]> => {
  const due = db
    .select({ outboxEventId: outboxEventsTable.outboxEventId })
    .from(outboxEventsTable)
    .where(
      and(
        eq(outboxEventsTable.deliveryStatus, DELIVERY_STATUS.PENDING),
        lte(outboxEventsTable.nextAttemptAt, now),
        lt(outboxEventsTable.attempts, MAX_DELIVERY_ATTEMPTS),
      ),
    )
    .orderBy(asc(outboxEventsTable.nextAttemptAt))
    .limit(DRAIN_BATCH_SIZE)
    .for('update', { skipLocked: true });

  return db
    .update(outboxEventsTable)
    .set({
      attempts: sql`${outboxEventsTable.attempts} + 1`,
      nextAttemptAt: new Date(now.getTime() + LEASE_MS),
    })
    .where(inArray(outboxEventsTable.outboxEventId, due))
    .returning();
};
