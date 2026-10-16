import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import type { DeliveryResult } from '@/lib/outbox/delivery-result';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { toLastError } from '@/lib/outbox/last-error';
import { retryDelayAfter } from '@/lib/outbox/retry-schedule';
import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';

type Claimed = Pick<OutboxEvent, 'outboxEventId' | 'attempts'>;
type Outcome = Partial<typeof outboxEventsTable.$inferInsert>;

const outcomeOf = (attempts: number, result: DeliveryResult, now: Date): Outcome => {
  if (result.delivered) return { deliveryStatus: DELIVERY_STATUS.DELIVERED, deliveredAt: now };
  const lastError = toLastError(result.error);
  const delay = retryDelayAfter(attempts);
  if (delay === undefined) return { deliveryStatus: DELIVERY_STATUS.DEAD, lastError };
  return { lastError, nextAttemptAt: new Date(now.getTime() + delay) };
};

export const recordDeliveryResult = async (
  db: Database,
  { outboxEventId, attempts }: Claimed,
  result: DeliveryResult,
  now: Date,
): Promise<void> => {
  await db
    .update(outboxEventsTable)
    .set(outcomeOf(attempts, result, now))
    .where(
      and(
        eq(outboxEventsTable.outboxEventId, outboxEventId),
        eq(outboxEventsTable.attempts, attempts),
        eq(outboxEventsTable.deliveryStatus, DELIVERY_STATUS.PENDING),
      ),
    );
};
