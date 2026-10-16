import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { tenantsTable, type Tenant } from '@/lib/tenants/schema';

export const findTenant = async (db: Database, tenantId: Tenant['tenantId']): Promise<Tenant | undefined> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.tenantId, tenantId)).limit(1);
  return tenant;
};
