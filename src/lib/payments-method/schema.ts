import { isNull } from 'drizzle-orm';
import { unique, uniqueIndex } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { tenantsTable } from '@/lib/tenants/schema';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { foreignKey } from '@matcha/infra/domain-drizzle/exports';

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };

export const paymentMethodsEntity = defineEntity(
  'payment_methods',
  {
    paymentMethodId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'PaymentMethodId')),
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
    providerConnectionId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => providerConnectionsTable.providerConnectionId, actions: restrict },
          'ProviderConnectionId',
        ),
      ),
    providerToken: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f)),
    captureRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f)),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
    replacedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [
      unique('payment_methods_one_per_capture').on(t.tenantId, t.captureRef),
      uniqueIndex('payment_methods_one_current_per_subscription').on(t.subscriptionId).where(isNull(t.replacedAt)),
      unique('payment_methods_connection_pin').on(t.paymentMethodId, t.providerConnectionId),
      foreignKey({
        name: 'payment_methods_subscription_connection',
        columns: [t.subscriptionId, t.providerConnectionId],
        foreignColumns: [subscriptionsTable.subscriptionId, subscriptionsTable.providerConnectionId],
      }).onDelete(REFERENTIAL_ACTION.RESTRICT),
    ],
  },
);

export const paymentMethodsTable = paymentMethodsEntity.table;

export type PaymentMethod = typeof paymentMethodsTable.$inferSelect;
