import type { Database } from '@/lib/db';
import { createCustomer, CREATE_CUSTOMER_OUTCOME } from '@/lib/customers/create-customer';
import type { Customer } from '@/lib/customers/schema';
import { createPlan } from '@/lib/plans/create-plan';
import type { Plan } from '@/lib/plans/schema';
import { createTenant, type CreateTenantInput } from '@/lib/tenants/create-tenant';
import type { Tenant } from '@/lib/tenants/schema';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { ACME } from '@tests/utils/tenant-fixtures';

const EXTERNAL_REF = 'user-42';

export type BillingContext = {
  apiKey: string;
  tenantId: Tenant['tenantId'];
  customerId: Customer['customerId'];
  plan: Plan;
};

export const seedBillingContext = async (db: Database, tenant: CreateTenantInput = ACME): Promise<BillingContext> => {
  const created = await createTenant(db, tenant);
  const { tenantId } = created.tenant;
  const customer = await createCustomer(db, tenantId, EXTERNAL_REF);
  if (customer.outcome !== CREATE_CUSTOMER_OUTCOME.CREATED) throw new Error('seed customer already existed');
  const plan = await createPlan(db, { tenantId, ...MONTHLY });
  return { apiKey: created.apiKey, tenantId, customerId: customer.customer.customerId, plan };
};
