import { z } from 'zod';
import { subscriptionStatusSchema } from '@/contract/subscription-status';

export const createSubscriptionResponseSchema = z.object({
  data: z.object({
    subscriptionId: z.uuid(),
    status: subscriptionStatusSchema,
    checkoutUrl: z.url(),
  }),
});

export type CreateSubscriptionResponse = z.infer<typeof createSubscriptionResponseSchema>;
