import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { customerResponseSchema } from '@/contract/customer-response';
import { planListResponseSchema } from '@/contract/plan-list-response';
import { createPlan } from '@/lib/plans/create-plan';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { postJson } from '@tests/utils/post-json';
import { silentLogger } from '@tests/utils/silent-logger';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('responses conform to the published contract with no extra fields', () => {
  it('GET /v1/plans', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });
      const body = await (
        await createApp({ logger: silentLogger, db: tx }).request('/v1/plans', bearer(apiKey))
      ).json();
      expect(planListResponseSchema.parse(body)).toEqual(body);
    });
  });

  it('POST /v1/customers and GET /v1/customers/:customerId', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = createApp({ logger: silentLogger, db: tx });
      const created = await (await app.request('/v1/customers', postJson(apiKey, { externalRef: 'user-42' }))).json();
      const fetched = await (await app.request(`/v1/customers/${created.data.customerId}`, bearer(apiKey))).json();
      expect(customerResponseSchema.parse(created)).toEqual(created);
      expect(customerResponseSchema.parse(fetched)).toEqual(fetched);
    });
  });
});
