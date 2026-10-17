import { describe, expect, it } from 'vitest';
import { createClient } from '@sdk/create-client';
import { PaymentServiceError } from '@sdk/payment-service-error';
import { recordingFetch, stubResponse } from '@tests/utils/sdk-client';

const BASE_URL = 'http://payments.test';
const API_KEY = 'sk_test_key';
const JSON_TYPE = 'application/json';
const PROBLEM_TYPE = 'application/problem+json';
const SUBSCRIPTION_ID = '0f6f1c1e-5f62-4b4e-9a53-3b1c8a0e7d11';
const CHECKOUT_URL = 'https://pay.test/checkout/1';
const CUSTOMER_ID = '7b0c5e0a-3e0f-4c43-8a63-0a0d3f0a9c55';
const RETURN_URL = 'https://tenant.test/return';
const INCOMPLETE = 'incomplete';

const clientWith = (inner: ReturnType<typeof stubResponse>, baseUrl = BASE_URL) => {
  const recorded = recordingFetch(inner);
  return { sdk: createClient({ baseUrl, apiKey: API_KEY, fetch: recorded.fetch }), calls: recorded.calls };
};

const createdBody = (extra: Record<string, unknown> = {}, omit?: string) => {
  const data: Record<string, unknown> = {
    subscriptionId: SUBSCRIPTION_ID,
    status: INCOMPLETE,
    checkoutUrl: CHECKOUT_URL,
    ...extra,
  };
  if (omit !== undefined) delete data[omit];
  return JSON.stringify({ data });
};

const createInput = { customerId: CUSTOMER_ID, planId: SUBSCRIPTION_ID, returnUrl: RETURN_URL };

describe('SDK request core', () => {
  it('sends the API key as a bearer token to baseUrl plus path, whatever trailing slash baseUrl has', async () => {
    const { sdk, calls } = clientWith(stubResponse(201, createdBody(), JSON_TYPE), `${BASE_URL}/`);
    await sdk.subscriptions.create(createInput);
    expect(calls[0]?.url).toBe(`${BASE_URL}/v1/subscriptions`);
    expect(calls[0]?.init.headers).toMatchObject({ authorization: `Bearer ${API_KEY}`, 'content-type': JSON_TYPE });
  });

  it('turns a problem+json answer into a PaymentServiceError carrying the problem', async () => {
    const problem = { type: 'about:blank', title: 'Conflict', status: 409, detail: 'resume_not_allowed' };
    const { sdk } = clientWith(stubResponse(409, JSON.stringify(problem), PROBLEM_TYPE));
    const failure = await sdk.subscriptions.resume(SUBSCRIPTION_ID).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PaymentServiceError);
    expect(failure).toMatchObject({ status: 409, problem, message: expect.stringContaining('resume_not_allowed') });
  });

  it('still throws a PaymentServiceError when an error answer is not problem+json, as from a proxy', async () => {
    const { sdk } = clientWith(stubResponse(502, '<html>bad gateway</html>', 'text/html'));
    const failure = await sdk.plans.list().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PaymentServiceError);
    expect(failure).toMatchObject({ status: 502, problem: { status: 502 } });
  });

  it('rejects a success answer that lacks a field the contract requires', async () => {
    const { sdk } = clientWith(stubResponse(201, createdBody({}, 'checkoutUrl'), JSON_TYPE));
    await expect(sdk.subscriptions.create(createInput)).rejects.toThrow();
  });

  it('rejects a success answer whose field has the wrong type', async () => {
    const { sdk } = clientWith(stubResponse(201, createdBody({ status: 7 }), JSON_TYPE));
    await expect(sdk.subscriptions.create(createInput)).rejects.toThrow();
  });

  it('ignores a field the contract does not know yet, so an additive server change breaks no installed SDK', async () => {
    const { sdk } = clientWith(stubResponse(201, createdBody({ invoiceUrl: 'https://x.test' }), JSON_TYPE));
    const created = await sdk.subscriptions.create(createInput);
    expect(created).toEqual({ subscriptionId: SUBSCRIPTION_ID, status: INCOMPLETE, checkoutUrl: CHECKOUT_URL });
  });

  it('rejects an invalid request before anything goes on the wire', async () => {
    const { sdk, calls } = clientWith(stubResponse(201, createdBody(), JSON_TYPE));
    await expect(sdk.subscriptions.create({ ...createInput, returnUrl: 'ftp://tenant.test/return' })).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('percent-encodes an id placed in a path', async () => {
    const { sdk, calls } = clientWith(stubResponse(404, '{}', PROBLEM_TYPE));
    await sdk.customers.get('a/b?c').catch(() => undefined);
    expect(calls[0]?.url).toBe(`${BASE_URL}/v1/customers/a%2Fb%3Fc`);
  });
});
