import { z } from 'zod';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

export const outboundEventSchema = z.object({
  eventId: z.uuid(),
  type: z.enum([
    'subscription.activated',
    'subscription.past_due',
    'subscription.canceled',
    'charge.succeeded',
    'charge.failed',
  ]),
  sequence: z.int().positive(),
  occurredAt: z.iso.datetime(),
  subscription: subscriptionSnapshotSchema,
});

export type OutboundEvent = z.infer<typeof outboundEventSchema>;
