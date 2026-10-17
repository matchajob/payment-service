import { describe, expect, it } from 'vitest';
import { createClient } from '@sdk/create-client';
import { testDb } from '@tests/utils/db';
import { SDK_BASE_URL, fetchInto } from '@tests/utils/sdk-client';
import { WEBHOOKS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';

const ALL_METHODS = 'ALL';
const TENANT_PREFIX = '/v1/';
const TRAILING_SLASH = /\/$/;

type Client = ReturnType<typeof createClient>;

const SDK_METHOD_FOR_ROUTE = {
  'GET /v1/plans': (c: Client) => c.plans.list,
  'POST /v1/customers': (c: Client) => c.customers.create,
  'GET /v1/customers/:customerId': (c: Client) => c.customers.get,
  'POST /v1/subscriptions': (c: Client) => c.subscriptions.create,
  'GET /v1/subscriptions/:subscriptionId': (c: Client) => c.subscriptions.get,
  'POST /v1/subscriptions/:subscriptionId/cancel': (c: Client) => c.subscriptions.cancel,
  'POST /v1/subscriptions/:subscriptionId/resume': (c: Client) => c.subscriptions.resume,
  'POST /v1/subscriptions/:subscriptionId/update-payment-method': (c: Client) => c.subscriptions.updatePaymentMethod,
};

describe('SDK covers every tenant-facing route (ADR 0015)', () => {
  const app = testApp(testDb());
  const tenantRoutes = app.routes
    .filter(
      (route) =>
        route.method !== ALL_METHODS && route.path.startsWith(TENANT_PREFIX) && !route.path.startsWith(WEBHOOKS_PATH),
    )
    .map((route) => `${route.method} ${route.path.replace(TRAILING_SLASH, '')}`);

  it('has an SDK method for every route the router serves, and no method for a route that is gone', () => {
    expect([...tenantRoutes].sort()).toEqual(Object.keys(SDK_METHOD_FOR_ROUTE).sort());
  });

  it.each(Object.entries(SDK_METHOD_FOR_ROUTE))('%s resolves to a function on the client', (_, methodOf) => {
    const client = createClient({ baseUrl: SDK_BASE_URL, apiKey: 'key', fetch: fetchInto(app) });
    expect(typeof methodOf(client)).toBe('function');
  });
});
