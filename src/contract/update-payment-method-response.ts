import { z } from 'zod';

export const updatePaymentMethodResponseSchema = z.object({
  data: z
    .object({
      subscriptionId: z.uuid().describe('The subscription whose card is being replaced.'),
      checkoutUrl: z.url().describe("The provider's hosted page that saves the new card without charging it."),
    })
    .describe('Where to send the customer to replace their card.'),
});

export type UpdatePaymentMethodResponse = z.infer<typeof updatePaymentMethodResponseSchema>;
