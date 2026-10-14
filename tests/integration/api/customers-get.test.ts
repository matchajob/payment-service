import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CUSTOMERS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { problemSchema } from '@/contract/problem';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { postJson } from '@tests/utils/post-json';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';

const EXTERNAL_REF = 'user-42';

describe('GET /v1/customers/:customerId', () => {
  it("returns the tenant's own customer", async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const created = await (await app.request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: EXTERNAL_REF }))).json();
      const res = await app.request(`${CUSTOMERS_PATH}/${created.data.customerId}`, bearer(apiKey));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(created);
    });
  });

  it("answers 404 for another tenant's customer, never 403", async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await createTenant(tx, ACME);
      const globex = await createTenant(tx, GLOBEX);
      const app = testApp(tx);
      const created = await (
        await app.request(CUSTOMERS_PATH, postJson(acme.apiKey, { externalRef: EXTERNAL_REF }))
      ).json();
      const res = await app.request(`${CUSTOMERS_PATH}/${created.data.customerId}`, bearer(globex.apiKey));
      expect(res.status).toBe(404);
      expect(problemSchema.parse(await res.json()).status).toBe(404);
    });
  });

  it('answers 404 for an unknown id', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(`${CUSTOMERS_PATH}/${randomUUID()}`, bearer(apiKey));
      expect(res.status).toBe(404);
    });
  });

  it('answers 404 for a malformed id instead of 500', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(`${CUSTOMERS_PATH}/not-a-uuid`, bearer(apiKey));
      expect(res.status).toBe(404);
    });
  });

  it("gives another tenant's id, an unknown id, and a malformed id the same 404 body", async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await createTenant(tx, ACME);
      const globex = await createTenant(tx, GLOBEX);
      const app = testApp(tx);
      const created = await (
        await app.request(CUSTOMERS_PATH, postJson(acme.apiKey, { externalRef: EXTERNAL_REF }))
      ).json();
      const bodies = await Promise.all(
        [created.data.customerId, randomUUID(), 'not-a-uuid'].map(async (id) =>
          (await app.request(`${CUSTOMERS_PATH}/${id}`, bearer(globex.apiKey))).json(),
        ),
      );
      expect(bodies).toEqual([
        { type: 'about:blank', title: 'Not Found', status: 404 },
        { type: 'about:blank', title: 'Not Found', status: 404 },
        { type: 'about:blank', title: 'Not Found', status: 404 },
      ]);
    });
  });
});
