import type { EventDelivery } from '@/contract/event-delivery';
import type { OutboxEvent } from '@/lib/outbox/schema';

export const toEventDelivery = (event: OutboxEvent): EventDelivery => ({
  eventId: event.outboxEventId,
  subscriptionId: event.subscriptionId,
  type: event.eventType,
  sequence: event.sequence,
  occurredAt: event.occurredAt.toISOString(),
  deliveryStatus: event.deliveryStatus,
  attempts: event.attempts,
  lastError: event.lastError,
});
