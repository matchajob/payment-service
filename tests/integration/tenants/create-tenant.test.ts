import { describe, expect, it } from 'vitest';
import { createTenant } from '@/lib/tenants/create-tenant';
import { hashApiKey } from '@/lib/tenants/hash-api-key';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('createTenant', () => {
  it('gives a new tenant the ratified policy defaults', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, { ...ACME, ...(await seedConnection(tx)) });
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
      const { tenant, apiKey } = await createTenant(tx, { ...ACME, ...(await seedConnection(tx)) });
      expect(tenant.apiKeyHash).toBe(hashApiKey(apiKey));
      expect(tenant.apiKeyHash).not.toContain(apiKey);
    });
  });

  it('stores the organization and the connection it is given (ADR 0010)', async () => {
    await withRollback(testDb(), async (tx) => {
      const connection = await seedConnection(tx);
      const { tenant } = await createTenant(tx, { ...ACME, ...connection });
      expect(tenant).toMatchObject(connection);
    });
  });

  it('rejects a second tenant with the same slug', async () => {
    await withRollback(testDb(), async (tx) => {
      const connection = await seedConnection(tx);
      await createTenant(tx, { ...ACME, ...connection });
      await expect(createTenant(tx, { ...ACME, ...connection })).rejects.toThrow();
    });
  });
});
