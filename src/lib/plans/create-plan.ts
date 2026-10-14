import type { Database } from '@/lib/db';
import { plansTable, type NewPlan, type Plan } from '@/lib/plans/schema';

export type CreatePlanInput = Pick<NewPlan, 'tenantId' | 'name' | 'amountMinor' | 'currency' | 'interval'>;

export const createPlan = async (db: Database, input: CreatePlanInput): Promise<Plan> => {
    const [plan] = await db.insert(plansTable).values(input).returning();
    if (plan === undefined) throw new Error('plan insert returned no row');
    return plan;
}