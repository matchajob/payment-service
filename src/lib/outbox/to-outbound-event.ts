import type { OutboundEvent } from '@/contract/outbound-event';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
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
  subscription: subscriptionSnapshotSchema.parse(snapshot),
});
