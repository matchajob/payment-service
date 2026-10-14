import { describe, expect, it } from 'vitest';
import { CUSTOMERS_PATH, PLANS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { customerResponseSchema } from '@/contract/customer-response';
import { planListResponseSchema } from '@/contract/plan-list-response';
import { createPlan } from '@/lib/plans/create-plan';
import { createTenant } from '@/lib/tenants/create-tenant';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { postJson } from '@tests/utils/post-json';
import { ACME } from '@tests/utils/tenant-fixtures';

describe('responses conform to the published contract with no extra fields', () => {
  it('GET /v1/plans', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });
      const body = await (await testApp(tx).request(PLANS_PATH, bearer(apiKey))).json();
      expect(planListResponseSchema.parse(body)).toEqual(body);
    });
  });

  it('POST /v1/customers and GET /v1/customers/:customerId', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const created = await (await app.request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: 'user-42' }))).json();
      const fetched = await (await app.request(`${CUSTOMERS_PATH}/${created.data.customerId}`, bearer(apiKey))).json();
      expect(customerResponseSchema.parse(created)).toEqual(created);
      expect(customerResponseSchema.parse(fetched)).toEqual(fetched);
    });
  });
});
