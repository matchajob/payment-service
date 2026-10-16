import type { Database } from '@/lib/db';
import { createCustomer, CREATE_CUSTOMER_OUTCOME } from '@/lib/customers/create-customer';
import type { Customer } from '@/lib/customers/schema';
import { createPlan } from '@/lib/plans/create-plan';
import type { Plan } from '@/lib/plans/schema';
import type { Tenant } from '@/lib/tenants/schema';
import type { SeededConnection } from '@tests/utils/connection-rows';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const EXTERNAL_REF = 'user-42';

export type BillingContext = SeededConnection & {
  apiKey: string;
  tenantId: Tenant['tenantId'];
  customerId: Customer['customerId'];
  plan: Plan;
};

export const seedBillingContext = async (
  db: Database,
  tenant: TenantFixture = ACME,
  connection?: SeededConnection,
): Promise<BillingContext> => {
  const created = await seedTenant(db, tenant, connection);
  const { tenantId } = created.tenant;
  const customer = await createCustomer(db, tenantId, EXTERNAL_REF);
  if (customer.outcome !== CREATE_CUSTOMER_OUTCOME.CREATED) throw new Error('seed customer already existed');
  const plan = await createPlan(db, { tenantId, ...MONTHLY });
  return {
    apiKey: created.apiKey,
    tenantId,
    customerId: customer.customer.customerId,
    plan,
    organizationId: created.organizationId,
    providerConnectionId: created.providerConnectionId,
  };
};
