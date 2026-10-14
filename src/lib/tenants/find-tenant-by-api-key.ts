import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { hashApiKey } from '@/lib/tenants/hash-api-key';
import { tenantsTable, type Tenant } from '@/lib/tenants/schema';

export const findTenantByApiKey = async (db: Database, apiKey: string): Promise<Tenant | undefined> => {
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.apiKeyHash, hashApiKey(apiKey)))
    .limit(1);
  return tenant;
};
