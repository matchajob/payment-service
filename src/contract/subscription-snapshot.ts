import { z } from 'zod';
import { subscriptionStatusSchema } from '@/contract/subscription-status';

const EXTERNAL_REF_MAX_LENGTH = 64;

export const subscriptionSnapshotSchema = z.object({
  subscriptionId: z.uuid(),
  customerId: z.uuid(),
  customerExternalRef: z.string().min(1).max(EXTERNAL_REF_MAX_LENGTH),
  planId: z.uuid(),
  status: subscriptionStatusSchema,
  entitled: z.boolean(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
});

export type SubscriptionSnapshot = z.infer<typeof subscriptionSnapshotSchema>;
