import { describe, expect, it } from 'vitest';
import { ADD_PLAN } from '@/lib/plans/add-plan-outcome';
import { addPlanToTenant } from '@/lib/plans/add-plan-to-tenant';
import { plansTable } from '@/lib/plans/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';
import { createPlan } from '@/lib/plans/create-plan';

const REPRICED = { ...MONTHLY, name: 'Pro monthly 2027', amountMinor: MONTHLY.amountMinor + 1000 };
const UNKNOWN_SLUG = 'nobody';

describe('addPlanToTenant: a new price is a new plan row, never an UPDATE (D8, code-review-1 N2)', () => {
  it("adds a plan to an existing tenant and leaves the tenant's other plans untouched", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      const existing = await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });

      const added = await addPlanToTenant(tx, { tenantSlug: ACME.slug, plan: REPRICED });

      expect(added).toEqual({
        outcome: ADD_PLAN.ADDED,
        plan: expect.objectContaining({ tenantId: tenant.tenantId, ...REPRICED }),
      });
      expect(await tx.select().from(plansTable)).toEqual(
        expect.arrayContaining([existing, expect.objectContaining(REPRICED)]),
      );
    });
  });

  it('adds nothing for a slug no tenant has', async () => {
    await withRollback(testDb(), async (tx) => {
      expect(await addPlanToTenant(tx, { tenantSlug: UNKNOWN_SLUG, plan: REPRICED })).toEqual({
        outcome: ADD_PLAN.TENANT_NOT_FOUND,
      });
      expect(await tx.$count(plansTable)).toBe(0);
    });
  });
});
