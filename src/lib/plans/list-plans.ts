import { asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { plansTable, type Plan } from '@/lib/plans/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const listPlans = async (db: Database, tenantId: Tenant['tenantId']): Promise<Plan[]> =>
  db.select().from(plansTable).where(eq(plansTable.tenantId, tenantId)).orderBy(asc(plansTable.createdAt), asc(plansTable.planId));