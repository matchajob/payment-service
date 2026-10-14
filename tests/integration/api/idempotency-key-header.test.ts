import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { customersTable } from '@/lib/customers/schema';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { CUSTOMERS_PATH, PLANS_PATH } from '@tests/utils/paths';
import { postJson } from '@tests/utils/post-json';
import { testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';

const EXTERNAL_REF = 'user-42';

describe('Idempotency-Key header', () => {
  it('rejects a mutation without the header with 400 and runs nothing', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: EXTERNAL_REF }, null));
      expect(res.status).toBe(400);
      expect(problemSchema.parse(await res.json()).status).toBe(400);
      expect(await tx.$count(customersTable)).toBe(0);
    });
  });

  it('rejects a key that is not a UUID with 400', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(
        CUSTOMERS_PATH,
        postJson(apiKey, { externalRef: EXTERNAL_REF }, 'not-a-uuid'),
      );
      expect(res.status).toBe(400);
    });
  });

  it('does not require the header on reads', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(PLANS_PATH, bearer(apiKey));
      expect(res.status).toBe(200);
    });
  });
});
