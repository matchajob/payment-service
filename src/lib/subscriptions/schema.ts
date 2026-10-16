import { sql } from 'drizzle-orm';
import { check, index, uniqueIndex, unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeBool } from '@matcha/infra/dzd/dzd-boolean';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { customersTable } from '@/lib/customers/schema';
import { plansTable } from '@/lib/plans/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { sqlLiteral } from '@/lib/sql-literal';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';

const FIRST_DAY = 1;
const LAST_DAY = 31;
const COUNTER_START = 0;

export const subscriptionStatusEnum = createDbEnumPair('subscriptionStatus', SUBSCRIPTION_STATUS);
export const subscriptionStatusPgEnum = subscriptionStatusEnum.dz;
export const scheduleOwnerEnum = createDbEnumPair('scheduleOwner', SCHEDULE_OWNER);
export const scheduleOwnerPgEnum = scheduleOwnerEnum.dz;
export const cancelReasonEnum = createDbEnumPair('cancelReason', CANCEL_REASON);
export const cancelReasonPgEnum = cancelReasonEnum.dz;

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };
export const ONE_LIVE_PER_CUSTOMER = 'subscriptions_one_live_per_customer';

export const subscriptionsEntity = defineEntity(
  'subscriptions',
  {
    subscriptionId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'SubscriptionId')),
    tenantId: (f) =>
      entityFromDzd(dzdThemeUuid.requiredRef(f, { ref: () => tenantsTable.tenantId, actions: restrict }, 'TenantId')),
    customerId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(f, { ref: () => customersTable.customerId, actions: restrict }, 'CustomerId'),
      ),
    planId: (f) =>
      entityFromDzd(dzdThemeUuid.requiredRef(f, { ref: () => plansTable.planId, actions: restrict }, 'PlanId')),
    providerConnectionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => providerConnectionsTable.providerConnectionId, actions: restrict },
          'ProviderConnectionId',
        ),
      ),
    status: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, subscriptionStatusEnum)),
    scheduleOwner: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, scheduleOwnerEnum)),
    checkoutSessionRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f), DZD_NULLABLE),
    currentPeriodEnd: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    anchorDay: (f) => entityFromDzd(makeDzdInteger(f, { minSize: FIRST_DAY, maxSize: LAST_DAY }), DZD_NULLABLE),
    cancelAtPeriodEnd: (f) => entityFromDzd(dzdThemeBool.defaultFalse(f)),
    canceledAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    cancelReason: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, cancelReasonEnum), DZD_NULLABLE),
    dunningAttempt: (f) => entityFromDzd(makeDzdInteger(f, { minSize: COUNTER_START, defaultValue: COUNTER_START })),
    dunningStartedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    nextRetryAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    sequence: (f) => entityFromDzd(makeDzdInteger(f, { minSize: COUNTER_START, defaultValue: COUNTER_START })),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      check(
        'subscriptions_cancel_flag_only_on_active',
        sql`${t.cancelAtPeriodEnd} = false or ${t.status} = ${sqlLiteral(SUBSCRIPTION_STATUS.ACTIVE)}`,
      ),
      check(
        'subscriptions_incomplete_has_no_period',
        sql`${t.status} <> ${sqlLiteral(SUBSCRIPTION_STATUS.INCOMPLETE)} or ${t.currentPeriodEnd} is null`,
      ),
      check(
        'subscriptions_live_has_period',
        sql`${t.status} not in (${sqlLiteral(SUBSCRIPTION_STATUS.ACTIVE)}, ${sqlLiteral(SUBSCRIPTION_STATUS.PAST_DUE)}) or ${t.currentPeriodEnd} is not null`,
      ),
      check(
        'subscriptions_retry_iff_past_due',
        sql`(${t.status} = ${sqlLiteral(SUBSCRIPTION_STATUS.PAST_DUE)}) = (${t.nextRetryAt} is not null)`,
      ),
      check(
        'subscriptions_dunning_clock_with_retry',
        sql`(${t.nextRetryAt} is null) = (${t.dunningStartedAt} is null)`,
      ),
      check(
        'subscriptions_cancel_reason_iff_canceled',
        sql`(${t.status} = ${sqlLiteral(SUBSCRIPTION_STATUS.CANCELED)}) = (${t.cancelReason} is not null)`,
      ),
      index('subscriptions_next_retry_at').on(t.nextRetryAt),
      uniqueIndex(ONE_LIVE_PER_CUSTOMER)
        .on(t.customerId)
        .where(
          sql`${t.status} in (${sqlLiteral(SUBSCRIPTION_STATUS.ACTIVE)}, ${sqlLiteral(SUBSCRIPTION_STATUS.PAST_DUE)})`,
        ),
      unique('subscriptions_connection_pin').on(t.subscriptionId, t.providerConnectionId),
    ],
  },
);

export const subscriptionsTable = subscriptionsEntity.table;
export const zSubscriptionRead = subscriptionsEntity.read;

export type Subscription = typeof subscriptionsTable.$inferSelect;
