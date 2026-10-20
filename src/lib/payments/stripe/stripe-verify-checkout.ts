import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { PaymentProvider } from '@/lib/payments/provider';
import { encodeCardToken } from '@/lib/payments/stripe/stripe-card-token';
import type { StripeContext } from '@/lib/payments/stripe/stripe-context';
import { stripeDataOf } from '@/lib/payments/stripe/stripe-data-of';
import { zRetrievedSession } from '@/lib/payments/stripe/stripe-retrieved-session';
import { STRIPE_FIELD, STRIPE_PATH, STRIPE_WIRE_VALUE } from '@/lib/payments/stripe/stripe-wire-values';

const NO_REUSABLE_CARD = 'stripe completed the checkout without a customer and payment method to charge again';

const EXPAND_INTENTS = [
  [STRIPE_FIELD.EXPAND, STRIPE_WIRE_VALUE.EXPAND_PAYMENT_INTENT],
  [STRIPE_FIELD.EXPAND, STRIPE_WIRE_VALUE.EXPAND_SETUP_INTENT],
] as const;

export const stripeVerifyCheckout =
  ({ client }: StripeContext): PaymentProvider['verifyCheckout'] =>
  async (sessionRef) => {
    const path = `${STRIPE_PATH.CHECKOUT_SESSIONS}/${encodeURIComponent(sessionRef)}`;
    const session = stripeDataOf(path, await client.get(path, EXPAND_INTENTS), zRetrievedSession);
    if (session.status !== STRIPE_WIRE_VALUE.SESSION_COMPLETE) return { outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED };
    const paymentMethod = session.setup_intent?.payment_method ?? session.payment_intent?.payment_method ?? null;
    if (session.customer === null || paymentMethod === null) throw new Error(NO_REUSABLE_CARD);
    return {
      outcome: CHECKOUT_VERIFICATION.CARD_SAVED,
      paymentMethodToken: encodeCardToken({ customer: session.customer, paymentMethod }),
    };
  };
