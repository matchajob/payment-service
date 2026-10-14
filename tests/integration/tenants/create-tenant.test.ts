import { describe, expect, it } from 'vitest';
import { createTenant } from '@/lib/tenants/create-tenant';
import { hashApiKey } from '@/lib/tenants/hash-api-key';
import { testDb, withRollback } from '@tests/utils/db';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('createTenant', () => {
  it('gives a new tenant the ratified policy defaults', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      expect(tenant).toMatchObject({
        checkoutTtlHours: 12,
        resumeAllowed: true,
        graceEntitlement: true,
        dunningScheduleDays: [1, 3, 7],
      });
    });
  });

  it('stores only the hash of the API key', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      expect(tenant.apiKeyHash).toBe(hashApiKey(apiKey));
      expect(tenant.apiKeyHash).not.toContain(apiKey);
    });
  });

  it('rejects a second tenant with the same slug', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      await expect(createTenant(tx, ACME)).rejects.toThrow();
    });
  });
});
