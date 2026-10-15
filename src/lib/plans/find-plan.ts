import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { plansTable, type Plan } from '@/lib/plans/schema';
import type { Tenant } from '@/lib/tenants/schema';

export const findPlan = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  planId: Plan['planId'],
): Promise<Plan | undefined> => {
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.tenantId, tenantId), eq(plansTable.planId, planId)))
    .limit(1);
  return plan;
};
