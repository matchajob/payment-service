import type { PaymentProviderName } from '@/lib/payments/payment-provider-name';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { WEBHOOKS_PREFIX } from '@/lib/webhooks/webhooks-prefix';

export const notifyUrlFor = (
  publicBaseUrl: string,
  provider: PaymentProviderName,
  providerConnectionId: ProviderConnection['providerConnectionId'],
): string => new URL(`${WEBHOOKS_PREFIX}/${provider}/${providerConnectionId}`, publicBaseUrl).toString();
