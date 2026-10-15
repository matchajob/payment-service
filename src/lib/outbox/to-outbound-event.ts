import type { OutboundEvent } from '@/contract/outbound-event';
import type { OutboxEvent } from '@/lib/outbox/schema';

export const toOutboundEvent = ({
  outboxEventId,
  eventType,
  sequence,
  occurredAt,
  snapshot,
}: OutboxEvent): OutboundEvent => ({
  eventId: outboxEventId,
  type: eventType,
  sequence,
  occurredAt: occurredAt.toISOString(),
  subscription: snapshot,
});
