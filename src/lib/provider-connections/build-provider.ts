import { growClient } from '@/infra/grow/grow-client';
import { stripeClient } from '@/infra/stripe/stripe-client';
import { growProvider } from '@/lib/payments/grow/grow-provider';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { stripeProvider } from '@/lib/payments/stripe/stripe-provider';
import { notifyUrlFor } from '@/lib/provider-connections/notify-url';
import type { ProviderConfig } from '@/lib/provider-connections/provider-config';
import type { BuildProvider } from '@/lib/provider-connections/provider-for';

export const buildProviderFrom =
  ({ publicBaseUrl, grow, stripe, fetch }: ProviderConfig): BuildProvider =>
  ({ providerConnectionId, provider, credentials }) => {
    switch (provider) {
      case PAYMENT_PROVIDER.GROW:
        return growProvider({
          client: growClient({ ...grow, fetch }),
          credentials,
          notifyUrl: notifyUrlFor(publicBaseUrl, provider, providerConnectionId),
        });
      case PAYMENT_PROVIDER.STRIPE:
        return stripeProvider({
          clientFor: (secretKey) => stripeClient({ ...stripe, secretKey, fetch }),
          credentials,
        });
    }
  };
