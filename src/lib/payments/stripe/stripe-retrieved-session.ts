import { z } from 'zod';

const zIntentPaymentMethod = z.object({ payment_method: z.string().nullable() }).nullable();

export const zRetrievedSession = z.object({
  status: z.string().nullable(),
  customer: z.string().nullable(),
  setup_intent: zIntentPaymentMethod,
  payment_intent: zIntentPaymentMethod,
});
