import { describe, expect, it } from 'vitest';
import { PLANS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { problemSchema } from '@/contract/problem';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('tenant authentication', () => {
  it('rejects a /v1 request with no API key with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PLANS_PATH);
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(401);
    });
  });

  it('rejects an unknown API key with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PLANS_PATH, bearer('not-a-real-key'));
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
    });
  });

  it('lets a request with a valid key through to the route', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await testApp(tx).request(PLANS_PATH, bearer(apiKey));
      expect(res.status).toBe(200);
    });
  });
});
