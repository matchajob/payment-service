import { and, eq, gte, lte } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { DEAD_LETTER_COLUMNS, type DeadLetter } from '@/lib/outbox/dead-letter';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { LEASE_EXPIRED_ERROR } from '@/lib/outbox/lease-expired-error';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { outboxEventsTable } from '@/lib/outbox/schema';

export const deadLetterExpiredLeases = (db: Database, now: Date): Promise<DeadLetter[]> =>
  db
    .update(outboxEventsTable)
    .set({ deliveryStatus: DELIVERY_STATUS.DEAD, lastError: LEASE_EXPIRED_ERROR })
    .where(
      and(
        eq(outboxEventsTable.deliveryStatus, DELIVERY_STATUS.PENDING),
        lte(outboxEventsTable.nextAttemptAt, now),
        gte(outboxEventsTable.attempts, MAX_DELIVERY_ATTEMPTS),
      ),
    )
    .returning(DEAD_LETTER_COLUMNS);
