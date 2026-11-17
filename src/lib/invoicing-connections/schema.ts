import { unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { makeDzdString } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { StrMaxSizes, StrMinSizes } from '@matcha/infra/validations/z-string';
import { invoicingServiceEnum } from '@/lib/invoicing/schema';
import { organizationsTable } from '@/lib/organizations/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';

export const invoicingConnectionsEntity = defineEntity(
  'invoicing_connections',
  {
    invoicingConnectionId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'InvoicingConnectionId')),
    organizationId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => organizationsTable.organizationId, actions: { onDelete: REFERENTIAL_ACTION.RESTRICT } },
          'OrganizationId',
        ),
      ),
    service: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, invoicingServiceEnum)),
    sealedCredentials: (f) =>
      entityFromDzd(makeDzdString(f, { maxSize: StrMaxSizes.blob, minSize: StrMinSizes.nonempty })),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      unique('invoicing_connections_organization_connection').on(t.organizationId, t.invoicingConnectionId),
    ],
  },
);

export const invoicingConnectionsTable = invoicingConnectionsEntity.table;
export const zInvoicingConnectionRead = invoicingConnectionsEntity.read.omit({ sealedCredentials: true });

export type InvoicingConnection = typeof invoicingConnectionsTable.$inferSelect;
export type InvoicingConnectionView = ReturnType<typeof zInvoicingConnectionRead.parse>;
