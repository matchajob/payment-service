import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { problemSchema } from '@/contract/problem';
import { createTenant } from '@/lib/tenants/create-tenant';
import { testDb, withRollback } from '@tests/utils/db';
import { silentLogger } from '@tests/utils/silent-logger';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('tenant authentication', () => {
  it('rejects a /v1 request with no API key with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans');
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(401);
    });
  });

  it('rejects an unknown API key with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', {
        headers: { authorization: 'Bearer not-a-real-key' },
      });
      expect(res.status).toBe(401);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
    });
  });

  it('lets a request with a valid key through to routing', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      expect(res.status).toBe(404);
    });
  });
});
