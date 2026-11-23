import { z } from 'zod';
import { eventDeliverySchema } from '@/contract/event-delivery';

export const eventResponseSchema = z.object({ data: eventDeliverySchema });

export type EventResponse = z.infer<typeof eventResponseSchema>;
