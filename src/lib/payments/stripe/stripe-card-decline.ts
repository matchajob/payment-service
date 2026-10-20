import { z } from 'zod';
import { STRIPE_WIRE_VALUE } from '@/lib/payments/stripe/stripe-wire-values';

export const zCardDecline = z.object({
  type: z.literal(STRIPE_WIRE_VALUE.CARD_ERROR),
  code: z.string().optional(),
  decline_code: z.string().optional(),
  message: z.string().optional(),
  payment_intent: z.object({ id: z.string() }).optional(),
});
