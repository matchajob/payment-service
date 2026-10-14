import { describe, expect, it } from 'vitest';
import { createPlan } from '@/lib/plans/create-plan';
import { createTenant } from '@/lib/tenants/create-tenant';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('createPlan', () => {
  it('rejects a non-positive amount at the database', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      await expect(createPlan(tx, { ...MONTHLY, amountMinor: 0, tenantId: tenant.tenantId })).rejects.toThrow();
    });
  });
});
