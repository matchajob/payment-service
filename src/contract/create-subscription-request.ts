import { z } from 'zod';
import { EXAMPLE } from '@/contract/contract-examples';

const WEB_PROTOCOL = /^https?$/;

export const createSubscriptionRequestSchema = z.object({
  customerId: z.uuid().describe('The customer to subscribe.'),
  planId: z.uuid().describe('The plan to bill. Get it from List plans.'),
  returnUrl: z.url({ protocol: WEB_PROTOCOL }).meta({
    description: 'Where the provider sends the customer after checkout, paid or not.',
    examples: [EXAMPLE.RETURN_URL],
  }),
});

export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionRequestSchema>;
