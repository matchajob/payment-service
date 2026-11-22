import { z } from 'zod';
import { subscriptionStatusSchema } from '@/contract/subscription-status';

export const createSubscriptionResponseSchema = z.object({
  data: z
    .object({
      subscriptionId: z.uuid().describe('Unique identifier for the new subscription.'),
      status: subscriptionStatusSchema,
      checkoutUrl: z.url().describe("The provider's hosted payment page. Send the customer here."),
    })
    .describe('The new subscription and where to send the customer.'),
});

export type CreateSubscriptionResponse = z.infer<typeof createSubscriptionResponseSchema>;
