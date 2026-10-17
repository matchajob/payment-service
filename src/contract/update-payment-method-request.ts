import { z } from 'zod';
import { createSubscriptionRequestSchema } from '@/contract/create-subscription-request';

export const updatePaymentMethodRequestSchema = z.object({
  returnUrl: createSubscriptionRequestSchema.shape.returnUrl,
});

export type UpdatePaymentMethodRequest = z.infer<typeof updatePaymentMethodRequestSchema>;
