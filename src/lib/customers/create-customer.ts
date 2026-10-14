import type { Database } from '@/lib/db';
import { customersTable, type Customer } from '@/lib/customers/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const CREATE_CUSTOMER_OUTCOME = { CREATED: 'created', DUPLICATE: 'duplicate' } as const;

export type CreateCustomerResult =
  | { outcome: typeof CREATE_CUSTOMER_OUTCOME.CREATED; customer: Customer }
  | { outcome: typeof CREATE_CUSTOMER_OUTCOME.DUPLICATE };

export const createCustomer = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  externalRef: string,
): Promise<CreateCustomerResult> => {
    //TODO should be a transaction
  const [customer] = await db
    .insert(customersTable)
    .values({ tenantId, externalRef })
    .onConflictDoNothing({ target: [customersTable.tenantId, customersTable.externalRef] })
    .returning();
  if (customer === undefined) return { outcome: CREATE_CUSTOMER_OUTCOME.DUPLICATE };
  return { outcome: CREATE_CUSTOMER_OUTCOME.CREATED, customer };
};