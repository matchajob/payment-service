import type { GrowClient } from '@/infra/grow/grow-client';
import { GROW_CAPABILITIES } from '@/lib/payments/grow/grow-capabilities';
import { growCharge } from '@/lib/payments/grow/grow-charge';
import { parseGrowCredentials } from '@/lib/payments/grow/grow-credentials';
import { growParseWebhook } from '@/lib/payments/grow/grow-parse-webhook';
import { growStartCheckout } from '@/lib/payments/grow/grow-start-checkout';
import { growVerifyCharge } from '@/lib/payments/grow/grow-verify-charge';
import { growVerifyCheckout } from '@/lib/payments/grow/grow-verify-checkout';
import type { PaymentProvider } from '@/lib/payments/provider';

export type GrowProviderDeps = { client: GrowClient; credentials: string; notifyUrl: string };

export const growProvider = ({ client, credentials, notifyUrl }: GrowProviderDeps): PaymentProvider => {
  const context = { client, credentials: parseGrowCredentials(credentials), notifyUrl };
  return {
    capabilities: GROW_CAPABILITIES,
    startCheckout: growStartCheckout(context),
    parseWebhook: growParseWebhook,
    verifyCheckout: growVerifyCheckout(context),
    charge: growCharge(context),
    verifyCharge: growVerifyCharge(context),
  };
};
