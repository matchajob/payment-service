import { z } from 'zod';

export const createSubscriptionResponseSchema = z.object({
  data: z.object({
    subscriptionId: z.uuid(),
    status: z.enum(['incomplete', 'active', 'past_due', 'canceled']),
    checkoutUrl: z.url(),
  }),
});

export type CreateSubscriptionResponse = z.infer<typeof createSubscriptionResponseSchema>;