import { describe, expect, it } from 'vitest';
import { PLANS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { createPlan } from '@/lib/plans/create-plan';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY, YEARLY } from '@tests/utils/plan-fixtures';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

describe('GET /v1/plans', () => {
  it("lists the tenant's plans with public fields only", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await seedTenant(tx, ACME);
      const plan = await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });
      const res = await testApp(tx).request(PLANS_PATH, bearer(apiKey));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        data: [{ planId: plan.planId, name: 'Pro monthly', amountMinor: 4900, currency: 'ILS', interval: 'month' }],
      });
    });
  });

  it("never shows another tenant's plans", async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await seedTenant(tx, ACME);
      const globex = await seedTenant(tx, GLOBEX);
      await createPlan(tx, { ...MONTHLY, tenantId: acme.tenant.tenantId });
      const globexPlan = await createPlan(tx, { ...YEARLY, tenantId: globex.tenant.tenantId });
      const res = await testApp(tx).request(PLANS_PATH, bearer(globex.apiKey));
      const body = await res.json();
      expect(body.data.map((plan: { planId: string }) => plan.planId)).toEqual([globexPlan.planId]);
    });
  });

  it('returns an empty list for a tenant with no plans', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(PLANS_PATH, bearer(apiKey));
      expect(await res.json()).toEqual({ data: [] });
    });
  });
});
