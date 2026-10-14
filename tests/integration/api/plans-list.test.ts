import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { createPlan } from '@/lib/plans/create-plan';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY, YEARLY } from '@tests/utils/plan-fixtures';
import { silentLogger } from '@tests/utils/silent-logger';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';

describe('GET /v1/plans', () => {
  it("lists the tenant's plans with public fields only", async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      const plan = await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', bearer(apiKey));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        data: [{ planId: plan.planId, name: 'Pro monthly', amountMinor: 4900, currency: 'ILS', interval: 'month' }],
      });
    });
  });

  it("never shows another tenant's plans", async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await createTenant(tx, ACME);
      const globex = await createTenant(tx, GLOBEX);
      await createPlan(tx, { ...MONTHLY, tenantId: acme.tenant.tenantId });
      const globexPlan = await createPlan(tx, { ...YEARLY, tenantId: globex.tenant.tenantId });
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', bearer(globex.apiKey));
      const body = await res.json();
      expect(body.data.map((plan: { planId: string }) => plan.planId)).toEqual([globexPlan.planId]);
    });
  });

  it('returns an empty list for a tenant with no plans', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', bearer(apiKey));
      expect(await res.json()).toEqual({ data: [] });
    });
  });
});
