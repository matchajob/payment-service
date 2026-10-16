import { unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeEnum } from '@matcha/infra/dzd/dzd-enum';
import { makeDzdString } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { StrMaxSizes, StrMinSizes } from '@matcha/infra/validations/z-string';
import { organizationsTable } from '@/lib/organizations/schema';
import { paymentProviderEnum } from '@/lib/payments/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';

export const providerConnectionsEntity = defineEntity(
  'provider_connections',
  {
    providerConnectionId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'ProviderConnectionId')),
    organizationId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => organizationsTable.organizationId, actions: { onDelete: REFERENTIAL_ACTION.RESTRICT } },
          'OrganizationId',
        ),
      ),
    provider: (f) => entityFromDzd(dzdThemeEnum.fromPair(f, paymentProviderEnum)),
    sealedCredentials: (f) =>
      entityFromDzd(makeDzdString(f, { maxSize: StrMaxSizes.blob, minSize: StrMinSizes.nonempty })),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      unique('provider_connections_organization_connection').on(t.organizationId, t.providerConnectionId),
    ],
  },
);

export const providerConnectionsTable = providerConnectionsEntity.table;
export const zProviderConnectionRead = providerConnectionsEntity.read.omit({ sealedCredentials: true });

export type ProviderConnection = typeof providerConnectionsTable.$inferSelect;
export type ProviderConnectionView = ReturnType<typeof zProviderConnectionRead.parse>;
