import { updatePaymentMethodResponseSchema } from '@/contract/update-payment-method-response';
import type { Database } from '@/lib/db';
import { fakeClock } from '@tests/utils/fake-clock';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postJson } from '@tests/utils/post-json';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import type { Renewing } from '@tests/utils/renewal-rows';
import { updatePaymentMethodPath } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';

export const CARD_UPDATE_RETURN_URL = 'https://tenant.test/billing/card-updated';

export const cardUpdateFlow = (tx: Database, { ctx, subscription }: Renewing, at: Date) => {
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(subscription.providerConnectionId);
  const clock = fakeClock(at);
  const app = testApp(tx, { providerFor: providers.providerFor, clock });

  const request = (returnUrl: string = CARD_UPDATE_RETURN_URL) =>
    app.request(updatePaymentMethodPath(subscription.subscriptionId), postJson(ctx.apiKey, { returnUrl }));

  const start = async (): Promise<string> => {
    const res = await request();
    if (res.status !== 201) throw new Error(`card update did not start: ${res.status}`);
    updatePaymentMethodResponseSchema.parse(await res.json());
    return provider.lastCheckoutSession().providerSessionRef;
  };

  const complete = (sessionRef: string, reference: string = subscription.subscriptionId) =>
    app.request(
      webhookPath(subscription.providerConnectionId),
      postWebhook(fakeCheckoutCompletedBody(reference, sessionRef)),
    );

  return { providers, provider, clock, app, request, start, complete };
};
