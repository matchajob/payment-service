import { z } from 'zod';

const WEB_PROTOCOL = /^https?$/;

export const createSubscriptionRequestSchema = z.object({
  customerId: z.uuid(),
  planId: z.uuid(),
  returnUrl: z.url({ protocol: WEB_PROTOCOL }),
});

export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionRequestSchema>;
