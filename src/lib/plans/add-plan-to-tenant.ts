import type { Database } from '@/lib/db';
import { ADD_PLAN } from '@/lib/plans/add-plan-outcome';
import { createPlan, type CreatePlanInput } from '@/lib/plans/create-plan';
import type { Plan } from '@/lib/plans/schema';
import { findTenantBySlug } from '@/lib/tenants/find-tenant-by-slug';
import type { Tenant } from '@/lib/tenants/schema';

export type AddPlanInput = { tenantSlug: Tenant['slug']; plan: Omit<CreatePlanInput, 'tenantId'> };

export type AddPlanResult =
  { outcome: typeof ADD_PLAN.ADDED; plan: Plan } | { outcome: typeof ADD_PLAN.TENANT_NOT_FOUND };

export const addPlanToTenant = async (db: Database, { tenantSlug, plan }: AddPlanInput): Promise<AddPlanResult> => {
  const tenant = await findTenantBySlug(db, tenantSlug);
  if (tenant === undefined) return { outcome: ADD_PLAN.TENANT_NOT_FOUND };
  return { outcome: ADD_PLAN.ADDED, plan: await createPlan(db, { ...plan, tenantId: tenant.tenantId }) };
};
