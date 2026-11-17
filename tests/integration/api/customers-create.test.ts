import { describe, expect, it } from 'vitest';
import { CUSTOMERS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { problemSchema } from '@/contract/problem';
import { testDb, withRollback } from '@tests/utils/db';
import { postJson } from '@tests/utils/post-json';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';
import { BILLING_DETAILS, NO_BILLING_DETAILS } from '@tests/utils/customer-billing-fixtures';

const EXTERNAL_REF = 'user-42';
const NOT_AN_EMAIL = 'not-an-email';

describe('POST /v1/customers', () => {
  it('creates a customer and answers 201 with its public fields, billing details null when not given', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: EXTERNAL_REF }));
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        data: { customerId: expect.any(String), externalRef: EXTERNAL_REF, ...NO_BILLING_DETAILS },
      });
    });
  });

  it('stores the billing details an invoice needs: name, email and tax id', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(
        CUSTOMERS_PATH,
        postJson(apiKey, { externalRef: EXTERNAL_REF, ...BILLING_DETAILS }),
      );
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        data: { customerId: expect.any(String), externalRef: EXTERNAL_REF, ...BILLING_DETAILS },
      });
    });
  });

  it('rejects a malformed email with 400', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(
        CUSTOMERS_PATH,
        postJson(apiKey, { externalRef: EXTERNAL_REF, email: NOT_AN_EMAIL }),
      );
      expect(res.status).toBe(400);
    });
  });

  it('rejects a body without externalRef with 400 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, {}));
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(400);
    });
  });

  it('rejects an empty externalRef with 400', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: '' }));
      expect(res.status).toBe(400);
    });
  });

  it('rejects malformed JSON with 400 instead of 500', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(CUSTOMERS_PATH, {
        ...postJson(apiKey, {}),
        body: '{ not json',
      });
      expect(res.status).toBe(400);
    });
  });

  it('rejects a duplicate externalRef for the same tenant with 409 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const app = testApp(tx);
      await app.request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: EXTERNAL_REF }));
      const res = await app.request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: EXTERNAL_REF }));
      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(409);
    });
  });

  it('accepts the same externalRef under another tenant', async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await seedTenant(tx, ACME);
      const globex = await seedTenant(tx, GLOBEX);
      const app = testApp(tx);
      await app.request(CUSTOMERS_PATH, postJson(acme.apiKey, { externalRef: EXTERNAL_REF }));
      const res = await app.request(CUSTOMERS_PATH, postJson(globex.apiKey, { externalRef: EXTERNAL_REF }));
      expect(res.status).toBe(201);
    });
  });
});
