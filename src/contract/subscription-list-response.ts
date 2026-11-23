import type { z } from 'zod';
import { listResponseSchema } from '@/contract/list-response';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

export const subscriptionListResponseSchema = listResponseSchema(
  subscriptionSnapshotSchema,
  'Your subscriptions, newest first.',
);

export type SubscriptionListResponse = z.infer<typeof subscriptionListResponseSchema>;
