import { describe, expect, it } from 'vitest';
import { COMPLETED_KEY_TTL_MS } from '@/lib/idempotency/completed-key-ttl';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { insertCompletedKey } from '@tests/utils/idempotency-rows';
import { PURGE_IDEMPOTENCY_PATH } from '@tests/utils/paths';
import { TEST_CRON_SECRET, TEST_NOW, testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('POST /internal/cron/purge-idempotency', () => {
  it("purges using the app's clock and returns the counts", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      await insertCompletedKey(tx, tenant.tenantId, new Date(TEST_NOW.getTime() - COMPLETED_KEY_TTL_MS - 1));
      await insertCompletedKey(tx, tenant.tenantId, TEST_NOW);
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, {
        ...bearer(TEST_CRON_SECRET),
        method: 'POST',
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ processed: 1, failed: 0 });
    });
  });
});
