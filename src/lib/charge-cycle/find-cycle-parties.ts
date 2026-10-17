import type { CycleParties } from '@/lib/charge-cycle/charge-cycle';
import { findCustomer } from '@/lib/customers/find-customer';
import type { Database } from '@/lib/db';
import { findPlan } from '@/lib/plans/find-plan';
import type { Subscription } from '@/lib/subscriptions/schema';
import { dunningScheduleOf } from '@/lib/tenants/dunning-schedule-of';
import { findTenant } from '@/lib/tenants/find-tenant';

const MISSING_PARENTS = 'charged subscription references a missing tenant, customer or plan';

export const findCycleParties = async (
  db: Database,
  { tenantId, customerId, planId }: Pick<Subscription, 'tenantId' | 'customerId' | 'planId'>,
): Promise<CycleParties> => {
  const tenant = await findTenant(db, tenantId);
  const customer = await findCustomer(db, tenantId, customerId);
  const plan = await findPlan(db, tenantId, planId);
  if (tenant === undefined || customer === undefined || plan === undefined) throw new Error(MISSING_PARENTS);
  return { tenant, customer, plan, dunningScheduleDays: dunningScheduleOf(tenant) };
};
