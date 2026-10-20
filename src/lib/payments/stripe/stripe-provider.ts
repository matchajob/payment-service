import type { StripeClient } from '@/infra/stripe/stripe-client';
import type { PaymentProvider } from '@/lib/payments/provider';
import { STRIPE_CAPABILITIES } from '@/lib/payments/stripe/stripe-capabilities';
import { stripeCharge } from '@/lib/payments/stripe/stripe-charge';
import { parseStripeCredentials } from '@/lib/payments/stripe/stripe-credentials';
import { stripeParseWebhook } from '@/lib/payments/stripe/stripe-parse-webhook';
import { stripeStartCheckout } from '@/lib/payments/stripe/stripe-start-checkout';
import { stripeVerifyCharge } from '@/lib/payments/stripe/stripe-verify-charge';
import { stripeVerifyCheckout } from '@/lib/payments/stripe/stripe-verify-checkout';

export type StripeProviderDeps = { clientFor: (secretKey: string) => StripeClient; credentials: string };

export const stripeProvider = ({ clientFor, credentials }: StripeProviderDeps): PaymentProvider => {
  const context = { client: clientFor(parseStripeCredentials(credentials).secretKey) };
  return {
    capabilities: STRIPE_CAPABILITIES,
    startCheckout: stripeStartCheckout(context),
    parseWebhook: stripeParseWebhook,
    verifyCheckout: stripeVerifyCheckout(context),
    charge: stripeCharge(context),
    verifyCharge: stripeVerifyCharge(context),
  };
};
