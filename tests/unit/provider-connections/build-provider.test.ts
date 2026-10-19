import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { buildProviderFrom } from '@/lib/provider-connections/build-provider';
import { zProviderConnectionRead } from '@/lib/provider-connections/schema';
import { fakeGrowFetch } from '@tests/utils/fake-grow-fetch';
import { GROW_TEST_PLAN_MINOR, GROW_TEST_REFERENCE, GROW_TEST_RETURN_URL } from '@tests/utils/grow-provider-under-test';
import { RECORDED_CREATE_PROCESS_OK } from '@tests/utils/grow-recorded-replies';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';
import { webhookPath } from '@tests/utils/post-webhook';
import { GROW_CREDENTIALS, GROW_USER_ID } from '@tests/utils/provider-credentials-fixtures';

const PUBLIC_BASE_URL = 'https://payments.test';
const GROW_BASE_URL = 'https://sandbox.grow.test/api/light/server/1.0/';
const PLATFORM_API_KEY = 'platform-api-key';
const TIMEOUT_MS = 50;
const CONNECTION_ID = zProviderConnectionRead.shape.providerConnectionId.parse('3b2f8a52-5f0e-4f7e-9a51-6c2b7e1d0a11');
const NOT_JSON = 'userId=grow-user-1';

const built = (credentials: string = GROW_CREDENTIALS, apiKey: string | undefined = undefined) => {
  const wire = fakeGrowFetch();
  const buildProvider = buildProviderFrom({
    publicBaseUrl: PUBLIC_BASE_URL,
    grow: { baseUrl: GROW_BASE_URL, apiKey, timeoutMs: TIMEOUT_MS },
    fetch: wire.fetch,
  });
  return {
    wire,
    build: () => buildProvider({ providerConnectionId: CONNECTION_ID, provider: PAYMENT_PROVIDER.GROW, credentials }),
  };
};

const startCheckout = async (provider: ReturnType<ReturnType<typeof built>['build']>) =>
  provider.startCheckout({
    mode: CHECKOUT_MODE.CAPTURE,
    reference: GROW_TEST_REFERENCE,
    amountMinor: GROW_TEST_PLAN_MINOR,
    currency: CURRENCY.ILS,
    returnUrl: GROW_TEST_RETURN_URL,
  });

describe('buildProviderFrom: a Grow connection gets a Grow adapter (WORKPLAN slice 13, ADR 0010 decision 3)', () => {
  it("builds the Grow adapter on the configured base URL with the connection's own credentials", async () => {
    const { wire, build } = built();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await startCheckout(build());
    expect(wire.requests).toEqual([
      expect.objectContaining({
        url: `${GROW_BASE_URL}${GROW_WIRE_METHOD.CREATE_PAYMENT_PROCESS}`,
        fields: expect.objectContaining({ userId: GROW_USER_ID }),
      }),
    ]);
  });

  it('points Grow at the webhook route the app serves for this connection (ADR 0010 decision 4)', async () => {
    const { wire, build } = built();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await startCheckout(build());
    expect(wire.requests[0]?.fields).toEqual(
      expect.objectContaining({ notifyUrl: `${PUBLIC_BASE_URL}${webhookPath(CONNECTION_ID)}` }),
    );
  });

  it("sends the platform's apiKey from config, not from the merchant's credentials", async () => {
    const { wire, build } = built(GROW_CREDENTIALS, PLATFORM_API_KEY);
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await startCheckout(build());
    expect(wire.requests[0]?.fields).toEqual(expect.objectContaining({ apiKey: PLATFORM_API_KEY }));
  });

  it('refuses credentials Grow cannot use, so createProviderConnection inserts nothing', () => {
    const { build } = built(NOT_JSON);
    expect(build).toThrow();
  });
});
