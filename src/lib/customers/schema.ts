import { unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { tenantsTable } from '@/lib/tenants/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';

export const customersEntity = defineEntity(
  'customers',
  {
    customerId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'CustomerId')),
    tenantId: (f) =>
        entityFromDzd(
        dzdThemeUuid.requiredRef(
            f,
            { ref: () => tenantsTable.tenantId, actions: { onDelete: REFERENTIAL_ACTION.RESTRICT } },
            'TenantId',
        ),
    ),
    externalRef: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [unique('customers_tenant_external_ref_unique').on(t.tenantId, t.externalRef)],
  },
);

export const customersTable = customersEntity.table;
export const zCustomerCreate = customersEntity.create;
export const zCustomerRead = customersEntity.read;

export type Customer = typeof customersTable.$inferSelect;