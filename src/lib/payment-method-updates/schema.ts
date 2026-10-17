import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { foreignKey, unique } from '@matcha/infra/domain-drizzle/exports';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { tenantsTable } from '@/lib/tenants/schema';

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };

export const paymentMethodUpdatesEntity = defineEntity(
  'payment_method_updates',
  {
    paymentMethodUpdateId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'PaymentMethodUpdateId')),
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
    sessionRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f)),
    requestedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    completedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [
      unique('payment_method_updates_one_per_session').on(t.providerConnectionId, t.sessionRef),
      foreignKey({
        name: 'payment_method_updates_subscription_connection',
        columns: [t.subscriptionId, t.providerConnectionId],
        foreignColumns: [subscriptionsTable.subscriptionId, subscriptionsTable.providerConnectionId],
      }).onDelete(REFERENTIAL_ACTION.RESTRICT),
    ],
  },
);

export const paymentMethodUpdatesTable = paymentMethodUpdatesEntity.table;

export type PaymentMethodUpdate = typeof paymentMethodUpdatesTable.$inferSelect;
