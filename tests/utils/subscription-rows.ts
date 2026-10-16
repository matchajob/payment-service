import type { Database } from '@/lib/db';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import type { CreateTenantInput } from '@/lib/tenants/create-tenant';
import { seedBillingContext } from '@tests/utils/billing-context';
import { ACME } from '@tests/utils/tenant-fixtures';

type NewSubscription = typeof subscriptionsTable.$inferInsert;
type Parents = Pick<NewSubscription, 'tenantId' | 'customerId' | 'planId'>;
type SubscriptionOverrides = Partial<Omit<NewSubscription, keyof Parents>>;

export const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');

export const seedSubscriptionParents = async (db: Database, tenant: CreateTenantInput = ACME): Promise<Parents> => {
  const { tenantId, customerId, plan } = await seedBillingContext(db, tenant);
  return { tenantId, customerId, planId: plan.planId };
};

export const insertSubscription = (db: Database, parents: Parents, overrides: SubscriptionOverrides = {}) =>
  db.insert(subscriptionsTable).values({
    ...parents,
    status: SUBSCRIPTION_STATUS.INCOMPLETE,
    scheduleOwner: SCHEDULE_OWNER.SELF,
    checkoutSessionRef: null,
    ...overrides,
  });
