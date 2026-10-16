import { z } from 'zod';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';

export const subscriptionResponseSchema = z.object({ data: subscriptionSnapshotSchema });

export type SubscriptionResponse = z.infer<typeof subscriptionResponseSchema>;
