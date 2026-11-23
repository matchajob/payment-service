import type { z } from 'zod';
import { eventDeliverySchema } from '@/contract/event-delivery';
import { listResponseSchema } from '@/contract/list-response';

export const eventListResponseSchema = listResponseSchema(eventDeliverySchema, 'Your events, newest first.');

export type EventListResponse = z.infer<typeof eventListResponseSchema>;
