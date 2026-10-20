import { stripeClient } from '@/infra/stripe/stripe-client';
import { CURRENCY } from '@/lib/money/currency';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { PaymentProvider } from '@/lib/payments/provider';
import { stripeProvider } from '@/lib/payments/stripe/stripe-provider';
import { fakeStripeFetch, type FakeStripeFetch } from '@tests/utils/fake-stripe-fetch';
import { STRIPE_CREDENTIALS } from '@tests/utils/stripe-credentials-fixtures';
import {
  completedSetupSessionReply,
  createdSessionReply,
  customerReply,
  STRIPE_PAYMENT_METHOD_ID,
} from '@tests/utils/stripe-session-replies';

export const STRIPE_TEST_BASE_URL = 'https://api.stripe.test';
export const STRIPE_TEST_TIMEOUT_MS = 50;
export const STRIPE_TEST_RETURN_URL = 'https://tenant.test/billing/return';
export const STRIPE_TEST_PLAN_MINOR = 4900;
export const STRIPE_TEST_REFERENCE = 'c1a7e3f0-8b2d-4e5f-9a6b-7c8d9e0f1a2b';

export type StripeUnderTest = { stripe: PaymentProvider; wire: FakeStripeFetch };

export const stripeUnderTest = (credentials: string = STRIPE_CREDENTIALS): StripeUnderTest => {
  const wire = fakeStripeFetch();
  const clientFor = (secretKey: string) =>
    stripeClient({ baseUrl: STRIPE_TEST_BASE_URL, secretKey, fetch: wire.fetch, timeoutMs: STRIPE_TEST_TIMEOUT_MS });
  return { stripe: stripeProvider({ clientFor, credentials }), wire };
};

export const startedStripeSession = async ({ stripe, wire }: StripeUnderTest) => {
  wire.reply(customerReply());
  wire.reply(createdSessionReply());
  return stripe.startCheckout({
    mode: CHECKOUT_MODE.CAPTURE,
    reference: STRIPE_TEST_REFERENCE,
    amountMinor: STRIPE_TEST_PLAN_MINOR,
    currency: CURRENCY.ILS,
    returnUrl: STRIPE_TEST_RETURN_URL,
  });
};

export const savedStripeCard = async (under: StripeUnderTest, paymentMethod: string = STRIPE_PAYMENT_METHOD_ID) => {
  const { providerSessionRef } = await startedStripeSession(under);
  under.wire.reply(completedSetupSessionReply(paymentMethod));
  const verified = await under.stripe.verifyCheckout(providerSessionRef);
  if (verified.outcome !== CHECKOUT_VERIFICATION.CARD_SAVED) throw new Error('stripe test card was not saved');
  under.wire.requests.length = 0;
  return verified.paymentMethodToken;
};
