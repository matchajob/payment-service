import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { customersTable, type Customer } from '@/lib/customers/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const findCustomer = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  customerId: Customer['customerId'],
): Promise<Customer | undefined> => {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.customerId, customerId)))
    .limit(1);
  return customer;
};