import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { tenantsTable, type Tenant } from '@/lib/tenants/schema';

export const findTenantBySlug = async (db: Database, slug: string): Promise<Tenant | undefined> => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, slug)).limit(1);
  return tenant;
};
