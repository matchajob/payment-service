import { z } from 'zod';
import type { PaymentProvider } from '@/lib/payments/provider';
import { STRIPE_WIRE_VALUE } from '@/lib/payments/stripe/stripe-wire-values';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';

const zCheckoutCompleted = z.object({
  type: z.literal(STRIPE_WIRE_VALUE.CHECKOUT_SESSION_COMPLETED),
  data: z.object({ object: z.object({ id: z.string().min(1), client_reference_id: z.string().min(1) }) }),
});

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

export const stripeParseWebhook: PaymentProvider['parseWebhook'] = (rawBody) => {
  const event = zCheckoutCompleted.safeParse(parseJson(rawBody));
  if (!event.success) return { kind: WEBHOOK_KIND.UNRECOGNIZED };
  const session = event.data.data.object;
  return { kind: WEBHOOK_KIND.CHECKOUT_COMPLETED, reference: session.client_reference_id, sessionRef: session.id };
};
