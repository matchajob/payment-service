import { sql } from 'drizzle-orm';
import { check, unique, uniqueIndex } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { dzdThemeInt, makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { createDbEnumPair } from '@matcha/infra/dzd/enumUtils-server';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { currencyEnum } from '@/lib/money/schema';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { sqlLiteral } from '@/lib/sql-literal';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { tenantsTable } from '@/lib/tenants/schema';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { foreignKey } from '@matcha/infra/domain-drizzle/exports';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';

const FIRST_ATTEMPT = 0;

export const chargeStatusEnum = createDbEnumPair('chargeStatus', CHARGE_STATUS);
export const chargeStatusPgEnum = chargeStatusEnum.dz;
export const reconcileFlagEnum = createDbEnumPair('reconcileFlag', RECONCILE_FLAG);
export const reconcileFlagPgEnum = reconcileFlagEnum.dz;

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };

export const chargesEntity = defineEntity(
  'charges',
  {
    chargeId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'ChargeId')),
    tenantId: (f) =>
      entityFromDzd(dzdThemeUuid.requiredRef(f, { ref: () => tenantsTable.tenantId, actions: restrict }, 'TenantId')),
    subscriptionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => subscriptionsTable.subscriptionId, actions: restrict },
          'SubscriptionId',
        ),
      ),
    paymentMethodId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => paymentMethodsTable.paymentMethodId, actions: restrict },
          'PaymentMethodId',
        ),
      ),
    providerConnectionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => providerConnectionsTable.providerConnectionId, actions: restrict },
          'ProviderConnectionId',
        ),
      ),
    periodEnd: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    attempt: (f) => entityFromDzd(makeDzdInteger(f, { minSize: FIRST_ATTEMPT })),
    amountMinor: (f) => entityFromDzd(dzdThemeInt.positive(f)),
    currency: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, currencyEnum)),
    status: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, chargeStatusEnum)),
    providerChargeRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f), DZD_NULLABLE),
    failureReason: (f) => entityFromDzd(dzdThemeStr.nonEmpty.errorMessage(f), DZD_NULLABLE),
    attemptedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    reconcileFlag: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, reconcileFlagEnum), DZD_NULLABLE),
    flaggedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [
      check(
        'charges_succeeded_has_provider_ref',
        sql`${t.status} <> ${sqlLiteral(CHARGE_STATUS.SUCCEEDED)} or ${t.providerChargeRef} is not null`,
      ),
      check(
        'charges_failure_reason_iff_failed',
        sql`(${t.status} = ${sqlLiteral(CHARGE_STATUS.FAILED)}) = (${t.failureReason} is not null)`,
      ),
      check('charges_reconcile_flag_iff_flagged_at', sql`(${t.reconcileFlag} is null) = (${t.flaggedAt} is null)`),
      unique('charges_one_per_attempt').on(t.subscriptionId, t.periodEnd, t.attempt),
      uniqueIndex('charges_one_live_per_period')
        .on(t.subscriptionId, t.periodEnd)
        .where(sql`${t.status} in (${sqlLiteral(CHARGE_STATUS.PENDING)}, ${sqlLiteral(CHARGE_STATUS.SUCCEEDED)})`),
      foreignKey({
        name: 'charges_subscription_connection',
        columns: [t.subscriptionId, t.providerConnectionId],
        foreignColumns: [subscriptionsTable.subscriptionId, subscriptionsTable.providerConnectionId],
      }).onDelete(REFERENTIAL_ACTION.RESTRICT),
      foreignKey({
        name: 'charges_payment_method_connection',
        columns: [t.paymentMethodId, t.providerConnectionId],
        foreignColumns: [paymentMethodsTable.paymentMethodId, paymentMethodsTable.providerConnectionId],
      }).onDelete(REFERENTIAL_ACTION.RESTRICT),
    ],
  },
);

export const chargesTable = chargesEntity.table;

export type Charge = typeof chargesTable.$inferSelect;
