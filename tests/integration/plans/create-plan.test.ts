import { describe, expect, it } from 'vitest';
import { createPlan } from '@/lib/plans/create-plan';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

describe('createPlan', () => {
  it('rejects a non-positive amount at the database', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      await expect(createPlan(tx, { ...MONTHLY, amountMinor: 0, tenantId: tenant.tenantId })).rejects.toThrow();
    });
  });
});
