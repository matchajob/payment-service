import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { PURGE_IDEMPOTENCY_PATH } from '@tests/utils/paths';
import { TEST_CRON_SECRET, testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const post = (init: RequestInit = {}): RequestInit => ({ ...init, method: 'POST' });

describe('cron authentication (ADR 0002)', () => {
  it('rejects a cron call with no secret with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post());
      expect(res.status).toBe(401);
      expect(problemSchema.parse(await res.json()).status).toBe(401);
    });
  });

  it('rejects a wrong secret with 401', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(`${TEST_CRON_SECRET}-wrong`)));
      expect(res.status).toBe(401);
    });
  });

  it("does not accept a tenant's API key", async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(apiKey)));
      expect(res.status).toBe(401);
    });
  });

  it('accepts the cron secret', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(TEST_CRON_SECRET)));
      expect(res.status).toBe(200);
    });
  });
});
