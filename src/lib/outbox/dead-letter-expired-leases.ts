import { and, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { LEASE_EXPIRED_ERROR } from '@/lib/outbox/lease-expired-error';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { outboxEventsTable } from '@/lib/outbox/schema';

export const deadLetterExpiredLeases = async (db: Database, now: Date): Promise<number> => {
    const dead = await db
        .update(outboxEventsTable)
        .set({ deliveryStatus: DELIVERY_STATUS.DEAD, lastError: LEASE_EXPIRED_ERROR })
        .where(
      and(
        eq(outboxEventsTable.deliveryStatus, DELIVERY_STATUS.PENDING),
        lte(outboxEventsTable.nextAttemptAt, now),
        gte(outboxEventsTable.attempts, MAX_DELIVERY_ATTEMPTS),
      ),
    )
    .returning({ outboxEventId: outboxEventsTable.outboxEventId });
  return dead.length;
}