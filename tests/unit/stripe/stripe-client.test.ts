import { describe, expect, it } from 'vitest';
import { stripeClient } from '@/infra/stripe/stripe-client';
import { fakeStripeFetch } from '@tests/utils/fake-stripe-fetch';
import { STRIPE_PATH } from '@tests/utils/stripe-paths';
import { cardDeclinedReply, HTTP_PAYMENT_REQUIRED } from '@tests/utils/stripe-payment-intent-replies';
import { createdSessionReply } from '@tests/utils/stripe-session-replies';

const BASE_URL = 'https://api.stripe.test';
const SECRET_KEY = 'sk_test_client';
const TIMEOUT_MS = 20;
const IDEMPOTENCY_KEY = 'sub-1:2026-02-15T10:00:00.000Z:0';
const FORM = 'application/x-www-form-urlencoded';
const HTTP_SERVICE_UNAVAILABLE = 503;
const PINNED_VERSION = '2026-09-30.endive';
const FIELDS = { mode: 'setup', 'metadata[reference]': 'ref 1' };
const EXPAND = [
  ['expand[]', 'payment_intent'],
  ['expand[]', 'setup_intent'],
] as const;

const clientOver = () => {
  const wire = fakeStripeFetch();
  return {
    wire,
    client: stripeClient({ baseUrl: BASE_URL, secretKey: SECRET_KEY, fetch: wire.fetch, timeoutMs: TIMEOUT_MS }),
  };
};

describe('stripeClient: the request (ADR 0020 decision 1)', () => {
  it('POSTs a form-encoded body with the secret key as a bearer token and the idempotency key', async () => {
    const { wire, client } = clientOver();
    wire.reply(createdSessionReply());
    await client.post(STRIPE_PATH.CHECKOUT_SESSIONS, FIELDS, IDEMPOTENCY_KEY);
    expect(wire.requests).toEqual([
      expect.objectContaining({
        url: `${BASE_URL}${STRIPE_PATH.CHECKOUT_SESSIONS}`,
        verb: 'POST',
        authorization: `Bearer ${SECRET_KEY}`,
        idempotencyKey: IDEMPOTENCY_KEY,
        contentType: expect.stringContaining(FORM),
        fields: FIELDS,
      }),
    ]);
  });

  it('pins the API version on every request, so an account default change cannot reshape replies', async () => {
    const { wire, client } = clientOver();
    wire.reply(createdSessionReply());
    wire.reply(createdSessionReply());
    await client.post(STRIPE_PATH.CHECKOUT_SESSIONS, FIELDS);
    await client.get(STRIPE_PATH.CHECKOUT_SESSIONS, EXPAND);
    expect(wire.requests.map((request) => request.stripeVersion)).toEqual([PINNED_VERSION, PINNED_VERSION]);
  });

  it('sends no idempotency key when the caller gives none', async () => {
    const { wire, client } = clientOver();
    wire.reply(createdSessionReply());
    await client.post(STRIPE_PATH.CHECKOUT_SESSIONS, FIELDS);
    expect(wire.requests[0]?.idempotencyKey).toBeNull();
  });

  it('GETs with a repeated query parameter kept in order', async () => {
    const { wire, client } = clientOver();
    wire.reply(createdSessionReply());
    await client.get(STRIPE_PATH.CHECKOUT_SESSIONS, EXPAND);
    expect(wire.requests[0]?.verb).toBe('GET');
    expect(wire.requests[0]?.authorization).toBe(`Bearer ${SECRET_KEY}`);
    expect([...(wire.requests[0]?.query ?? [])]).toEqual(EXPAND);
  });
});

describe('stripeClient: the reply', () => {
  it('returns the parsed body of a 2xx as ok', async () => {
    const { wire, client } = clientOver();
    wire.reply(createdSessionReply());
    expect(await client.post(STRIPE_PATH.CHECKOUT_SESSIONS, FIELDS)).toEqual({ ok: true, data: createdSessionReply() });
  });

  it("returns a 4xx with Stripe's error object, so the adapter can tell a decline apart", async () => {
    const { wire, client } = clientOver();
    wire.reply(cardDeclinedReply(), HTTP_PAYMENT_REQUIRED);
    expect(await client.post(STRIPE_PATH.PAYMENT_INTENTS, FIELDS)).toEqual({
      ok: false,
      status: HTTP_PAYMENT_REQUIRED,
      error: cardDeclinedReply().error,
    });
  });

  it('throws on a 5xx, which says nothing about whether Stripe acted', async () => {
    const { wire, client } = clientOver();
    wire.reply({ error: { type: 'api_error' } }, HTTP_SERVICE_UNAVAILABLE);
    await expect(client.post(STRIPE_PATH.PAYMENT_INTENTS, FIELDS)).rejects.toThrow();
  });

  it('throws on a body that is not JSON', async () => {
    const { wire, client } = clientOver();
    wire.reply('<html>bad gateway</html>');
    await expect(client.get(STRIPE_PATH.CHECKOUT_SESSIONS, [])).rejects.toThrow();
  });

  it('throws when the network call fails', async () => {
    const { wire, client } = clientOver();
    wire.rejectWith(new TypeError('fetch failed'));
    await expect(client.get(STRIPE_PATH.CHECKOUT_SESSIONS, [])).rejects.toThrow();
  });

  it('gives up after the timeout', async () => {
    const { wire, client } = clientOver();
    wire.hang();
    await expect(client.get(STRIPE_PATH.CHECKOUT_SESSIONS, [])).rejects.toThrow();
  });
});
