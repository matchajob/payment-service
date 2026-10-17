import { z } from 'zod';

export const updatePaymentMethodResponseSchema = z.object({
  data: z.object({
    subscriptionId: z.uuid(),
    checkoutUrl: z.url(),
  }),
});

export type UpdatePaymentMethodResponse = z.infer<typeof updatePaymentMethodResponseSchema>;
