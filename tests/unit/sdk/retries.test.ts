import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createClient } from '@sdk/create-client';
import { PaymentServiceError } from '@sdk/payment-service-error';
import { recordingSleep, scriptedFetch, type ScriptedStep } from '@tests/utils/sdk-client';

const BASE_URL = 'http://payments.test';
const API_KEY = 'sk_test_key';
const IDEMPOTENCY_HEADER = 'idempotency-key';
const PROBLEM_TYPE = 'application/problem+json';
const JSON_TYPE = 'application/json';
const REF = 'user-1';
const BASE_DELAY_MS = 200;
const DEFAULT_RETRIES = 2;

const NETWORK_MESSAGE = 'fetch failed';
const CONTENT_TYPE_HEADER = 'content-type';
const UNAVAILABLE = 503;
const OK = 200;

const network = () => new TypeError(NETWORK_MESSAGE);
const failure = (status: number): ScriptedStep =>
  new Response(JSON.stringify({ type: 'about:blank', title: 'x', status }), {
    status,
    headers: { [CONTENT_TYPE_HEADER]: PROBLEM_TYPE },
  });
const customerCreated = (): ScriptedStep =>
  new Response(JSON.stringify({ data: { customerId: randomUUID(), externalRef: REF } }), {
    status: 201,
    headers: { [CONTENT_TYPE_HEADER]: JSON_TYPE },
  });

const clientFor = (steps: ScriptedStep[], options: { retries?: number; timeoutMs?: number } = {}) => {
  const script = scriptedFetch(...steps);
  const slept = recordingSleep();
  const sdk = createClient({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: script.fetch, sleep: slept.sleep, ...options });
  return { sdk, calls: script.calls, delays: slept.delays };
};

describe('SDK retries (WORKPLAN 23 decision, ADR 0006)', () => {
  it('retries a network error and returns the later success', async () => {
    const { sdk, calls, delays } = clientFor([network(), customerCreated()]);
    expect(await sdk.customers.create({ externalRef: REF })).toMatchObject({ externalRef: REF });
    expect(calls).toHaveLength(2);
    expect(delays).toHaveLength(1);
  });

  it.each([502, 503, 504])('retries a %s answer', async (status) => {
    const { sdk, calls } = clientFor([failure(status), customerCreated()]);
    await sdk.customers.create({ externalRef: REF });
    expect(calls).toHaveLength(2);
  });

  it('sends the same idempotency key on every attempt, so a retry can never run the call twice', async () => {
    const { sdk, calls } = clientFor([network(), failure(UNAVAILABLE), customerCreated()]);
    await sdk.customers.create({ externalRef: REF });
    const keys = calls.map((call) => call.init.headers[IDEMPOTENCY_HEADER]);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toEqual(expect.any(String));
  });

  it('keeps the key the caller names across attempts', async () => {
    const { sdk, calls } = clientFor([network(), customerCreated()]);
    const key = randomUUID();
    await sdk.customers.create({ externalRef: REF }, { idempotencyKey: key });
    expect(calls.map((call) => call.init.headers[IDEMPOTENCY_HEADER])).toEqual([key, key]);
  });

  it('retries a read as well', async () => {
    const { sdk, calls } = clientFor([
      failure(UNAVAILABLE),
      new Response(JSON.stringify({ data: [] }), { status: OK }),
    ]);
    expect(await sdk.plans.list()).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('gives up after two retries and throws the last answer as a typed error', async () => {
    const { sdk, calls, delays } = clientFor([failure(UNAVAILABLE), failure(UNAVAILABLE), failure(UNAVAILABLE)]);
    const result = await sdk.customers.create({ externalRef: REF }).catch((error: unknown) => error);
    expect(result).toBeInstanceOf(PaymentServiceError);
    expect(result).toMatchObject({ status: UNAVAILABLE });
    expect(calls).toHaveLength(DEFAULT_RETRIES + 1);
    expect(delays).toHaveLength(DEFAULT_RETRIES);
  });

  it('rethrows the network error itself when every attempt fails', async () => {
    const { sdk, calls } = clientFor([network(), network(), network()]);
    await expect(sdk.customers.create({ externalRef: REF })).rejects.toThrow(NETWORK_MESSAGE);
    expect(calls).toHaveLength(DEFAULT_RETRIES + 1);
  });

  it.each([400, 401, 404, 409, 422, 500])('does not retry a %s answer', async (status) => {
    const { sdk, calls, delays } = clientFor([failure(status), customerCreated()]);
    await expect(sdk.customers.create({ externalRef: REF })).rejects.toBeInstanceOf(PaymentServiceError);
    expect(calls).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it('does not retry when retries is 0', async () => {
    const { sdk, calls } = clientFor([network(), customerCreated()], { retries: 0 });
    await expect(sdk.customers.create({ externalRef: REF })).rejects.toThrow(NETWORK_MESSAGE);
    expect(calls).toHaveLength(1);
  });

  it('waits between attempts with a jittered exponential delay', async () => {
    const { sdk, delays } = clientFor([network(), network(), network(), customerCreated()], { retries: 3 });
    await sdk.customers.create({ externalRef: REF });
    expect(delays).toHaveLength(3);
    delays.forEach((delay, attempt) => {
      const ceiling = BASE_DELAY_MS * 2 ** attempt;
      expect(delay).toBeGreaterThanOrEqual(ceiling / 2);
      expect(delay).toBeLessThanOrEqual(ceiling);
    });
  });
});

describe('SDK request timeout', () => {
  it('gives every attempt an abort signal', async () => {
    const { sdk, calls } = clientFor([network(), customerCreated()]);
    await sdk.customers.create({ externalRef: REF });
    expect(calls.map((call) => call.init.signal)).toEqual([expect.any(AbortSignal), expect.any(AbortSignal)]);
  });

  it('aborts a request that never answers, so a hung connection fails instead of waiting forever', async () => {
    const hangs = async (_url: string, init: { signal?: AbortSignal }) =>
      new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
    const sdk = createClient({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: hangs, retries: 0, timeoutMs: 20 });
    await expect(sdk.plans.list()).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
