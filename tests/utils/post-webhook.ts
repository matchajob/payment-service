import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { WEBHOOKS_PATH } from '@tests/utils/paths';

export const webhookPath = (providerConnectionId: string, provider: string = PAYMENT_PROVIDER.GROW) =>
  `${WEBHOOKS_PATH}/${provider}/${providerConnectionId}`;

export const postWebhook = (rawBody: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: rawBody,
});
