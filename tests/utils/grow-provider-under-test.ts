import { growClient } from '@/infra/grow/grow-client';
import { CURRENCY } from '@/lib/money/currency';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import { growProvider } from '@/lib/payments/grow/grow-provider';
import type { PaymentProvider } from '@/lib/payments/provider';
import { fakeGrowFetch, type FakeGrowFetch } from '@tests/utils/fake-grow-fetch';
import { cardSavedReply, SAVED_CARD_TOKEN } from '@tests/utils/grow-built-replies';
import { GROW_CREDENTIALS } from '@tests/utils/provider-credentials-fixtures';
import { RECORDED_CREATE_PROCESS_OK } from '@tests/utils/grow-recorded-replies';

export const GROW_TEST_BASE_URL = 'https://sandbox.grow.test/api/light/server/1.0/';
export const GROW_TEST_NOTIFY_URL = 'https://payments.test/v1/webhooks/grow/3b2f8a52-5f0e-4f7e-9a51-6c2b7e1d0a11';
export const GROW_TEST_TIMEOUT_MS = 50;
export const GROW_TEST_RETURN_URL = 'https://tenant.test/billing/return';
export const GROW_TEST_PLAN_MINOR = 4900;
export const GROW_TEST_REFERENCE = 'c1a7e3f0-8b2d-4e5f-9a6b-7c8d9e0f1a2b';

export type GrowUnderTest = { grow: PaymentProvider; wire: FakeGrowFetch };

export const growUnderTest = (credentials: string = GROW_CREDENTIALS): GrowUnderTest => {
  const wire = fakeGrowFetch();
  const client = growClient({
    baseUrl: GROW_TEST_BASE_URL,
    apiKey: undefined,
    fetch: wire.fetch,
    timeoutMs: GROW_TEST_TIMEOUT_MS,
  });
  return { grow: growProvider({ client, credentials, notifyUrl: GROW_TEST_NOTIFY_URL }), wire };
};

export const startedSessionRef = async ({ grow, wire }: GrowUnderTest, reply = RECORDED_CREATE_PROCESS_OK) => {
  wire.reply(reply);
  const { providerSessionRef } = await grow.startCheckout({
    mode: CHECKOUT_MODE.CAPTURE,
    reference: GROW_TEST_REFERENCE,
    amountMinor: GROW_TEST_PLAN_MINOR,
    currency: CURRENCY.ILS,
    returnUrl: GROW_TEST_RETURN_URL,
  });
  return providerSessionRef;
};

export const savedCardToken = async (under: GrowUnderTest, cardToken: string = SAVED_CARD_TOKEN) => {
  const sessionRef = await startedSessionRef(under);
  under.wire.reply(cardSavedReply(cardToken));
  const verified = await under.grow.verifyCheckout(sessionRef);
  if (verified.outcome !== CHECKOUT_VERIFICATION.CARD_SAVED) throw new Error('grow test card was not saved');
  under.wire.requests.length = 0;
  return verified.paymentMethodToken;
};
