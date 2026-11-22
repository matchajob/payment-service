import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';
import { SUBSCRIPTION_EXAMPLE } from '@/contract/subscription-example';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

export const outboundEventSchema = z
  .object({
    eventId: z.uuid().describe('Unique identifier for the event. A retried delivery carries the same eventId.'),
    type: z
      .enum([
        'subscription.activated',
        'subscription.past_due',
        'subscription.canceled',
        'charge.succeeded',
        'charge.failed',
      ])
      .describe('What happened.'),
    sequence: z
      .int()
      .positive()
      .meta({
        description:
          'Increases with every event of the same subscription. Apply an event only if its sequence is higher than the one you stored.',
        examples: [4],
      }),
    occurredAt: z.iso.datetime().describe('When the change happened, in ISO 8601 UTC.'),
    subscription: subscriptionSnapshotSchema,
  })
  .meta({
    id: 'Event',
    title: 'The Event object',
    examples: [
      {
        eventId: EXAMPLE.EVENT_ID,
        type: 'charge.succeeded',
        sequence: EXAMPLE.EVENT_SEQUENCE,
        occurredAt: EXAMPLE.OCCURRED_AT,
        subscription: SUBSCRIPTION_EXAMPLE,
      },
    ],
    description: 'A signed message sent to your webhook URL. It carries the full subscription after the change.',
  });

export type OutboundEvent = z.infer<typeof outboundEventSchema>;
