import { z } from 'zod';

const STRIPE_CARD = 'stripe.card';
const NOT_OURS = 'not a payment method token this Stripe adapter issued';

const zCardToken = z.object({ kind: z.literal(STRIPE_CARD), customer: z.string(), paymentMethod: z.string() });

export type StripeCard = Omit<z.infer<typeof zCardToken>, 'kind'>;

export const encodeCardToken = ({ customer, paymentMethod }: StripeCard): string =>
  JSON.stringify({ kind: STRIPE_CARD, customer, paymentMethod });

export const decodeCardToken = (token: string): StripeCard => {
  try {
    return zCardToken.parse(JSON.parse(token));
  } catch {
    throw new Error(NOT_OURS);
  }
};
