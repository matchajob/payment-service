import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';
import { deliveryStatusSchema } from '@/contract/delivery-status';
import { outboundEventSchema } from '@/contract/outbound-event';

export const eventDeliverySchema = z
  .object({
    eventId: outboundEventSchema.shape.eventId,
    subscriptionId: z.uuid().describe('The subscription the event is about.'),
    type: outboundEventSchema.shape.type,
    sequence: outboundEventSchema.shape.sequence,
    occurredAt: outboundEventSchema.shape.occurredAt,
    deliveryStatus: deliveryStatusSchema,
    attempts: z.int().nonnegative().describe('How many deliveries were tried since the event was queued or redriven.'),
    lastError: z.string().nullable().describe('Why the last delivery failed. Null after a success or a redrive.'),
  })
  .meta({
    id: 'EventDelivery',
    title: 'The EventDelivery object',
    description: 'An event you were sent, with the state of its delivery to your webhook URL.',
    examples: [
      {
        eventId: EXAMPLE.EVENT_ID,
        subscriptionId: EXAMPLE.SUBSCRIPTION_ID,
        type: 'charge.failed',
        sequence: EXAMPLE.EVENT_SEQUENCE,
        occurredAt: EXAMPLE.OCCURRED_AT,
        deliveryStatus: 'dead',
        attempts: EXAMPLE.DELIVERY_ATTEMPTS,
        lastError: EXAMPLE.DELIVERY_ERROR,
      },
    ],
  });

export type EventDelivery = z.infer<typeof eventDeliverySchema>;
