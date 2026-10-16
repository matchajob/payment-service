import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { seedBillingContext } from '@tests/utils/billing-context';
import type { SeededConnection } from '@tests/utils/connection-rows';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

type NewSubscription = typeof subscriptionsTable.$inferInsert;
type Parents = Pick<NewSubscription, 'tenantId' | 'customerId' | 'planId' | 'providerConnectionId'>;
type SubscriptionOverrides = Partial<Omit<NewSubscription, keyof Parents>>;

export const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');

const STATE_COLUMNS: Partial<Record<NewSubscription['status'], SubscriptionOverrides>> = {
  [SUBSCRIPTION_STATUS.PAST_DUE]: {
    dunningStartedAt: PERIOD_END,
    nextRetryAt: new Date(PERIOD_END.getTime() + DAY_MS),
  },
  [SUBSCRIPTION_STATUS.CANCELED]: { canceledAt: PERIOD_END, cancelReason: CANCEL_REASON.CUSTOMER_REQUEST },
};

export const seedSubscriptionParents = async (
  db: Database,
  tenant: TenantFixture = ACME,
  connection?: SeededConnection,
): Promise<Parents> => {
  const { tenantId, customerId, plan, providerConnectionId } = await seedBillingContext(db, tenant, connection);
  return { tenantId, customerId, planId: plan.planId, providerConnectionId };
};

export const insertSubscription = (db: Database, parents: Parents, overrides: SubscriptionOverrides = {}) =>
  db.insert(subscriptionsTable).values({
    ...parents,
    status: SUBSCRIPTION_STATUS.INCOMPLETE,
    scheduleOwner: SCHEDULE_OWNER.SELF,
    checkoutSessionRef: null,
    ...(overrides.status === undefined ? {} : STATE_COLUMNS[overrides.status]),
    ...overrides,
  });
