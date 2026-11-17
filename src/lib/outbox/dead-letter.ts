import { outboxEventsTable, type OutboxEvent } from '@/lib/outbox/schema';

export type DeadLetter = Pick<OutboxEvent, 'outboxEventId' | 'tenantId' | 'eventType' | 'lastError'>;

export const DEAD_LETTER_COLUMNS = {
  outboxEventId: outboxEventsTable.outboxEventId,
  tenantId: outboxEventsTable.tenantId,
  eventType: outboxEventsTable.eventType,
  lastError: outboxEventsTable.lastError,
};
