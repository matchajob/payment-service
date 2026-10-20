import { z } from 'zod';
import { zStripeCurrency } from '@/lib/payments/stripe/stripe-currency';
import { STRIPE_METADATA_KEY } from '@/lib/payments/stripe/stripe-wire-values';

const zPaymentError = z.object({ code: z.string().optional(), decline_code: z.string().optional() });

export const zPaymentIntent = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int(),
  currency: zStripeCurrency,
  last_payment_error: zPaymentError.nullish(),
  metadata: z.object({ [STRIPE_METADATA_KEY.DEDUP_KEY]: z.string() }),
});

export const zPaymentIntentSearch = z.object({ data: z.array(zPaymentIntent) });

export type StripePaymentIntent = z.infer<typeof zPaymentIntent>;
