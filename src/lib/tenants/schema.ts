import { z } from 'zod';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeBool } from '@matcha/infra/dzd/dzd-boolean';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { makeDzdJson } from '@matcha/infra/dzd/dzd-json';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';
import { foreignKey, unique } from '@matcha/infra/domain-drizzle/exports';
import { organizationsTable } from '@/lib/organizations/schema';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';

const restrict = { onDelete: REFERENTIAL_ACTION.RESTRICT };
const MIN_CHECKOUT_TTL_HOURS = 1;
const MIN_DUNNING_RETRIES = 1;

export const tenantsEntity = defineEntity(
  'tenants',
  {
    tenantId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'TenantId')),
    organizationId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => organizationsTable.organizationId, actions: restrict },
          'OrganizationId',
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
    slug: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
    apiKeyHash: (f) => entityFromDzd(dzdThemeStr.hash(f)),
    webhookUrl: (f) => entityFromDzd(dzdThemeStr.nonEmpty.address(f)),
    webhookSecret: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f)),
    checkoutTtlHours: (f) => entityFromDzd(makeDzdInteger(f, { minSize: MIN_CHECKOUT_TTL_HOURS })),
    resumeAllowed: (f) => entityFromDzd(dzdThemeBool.required(f)),
    graceEntitlement: (f) => entityFromDzd(dzdThemeBool.required(f)),
    dunningScheduleDays: (f) => entityFromDzd(makeDzdJson(f, z.array(z.int().positive()).min(MIN_DUNNING_RETRIES))),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      foreignKey({
        name: 'tenants_connection_same_organization',
        columns: [t.organizationId, t.providerConnectionId],
        foreignColumns: [providerConnectionsTable.organizationId, providerConnectionsTable.providerConnectionId],
      }).onDelete(REFERENTIAL_ACTION.RESTRICT),

      unique('tenants_slug_unique').on(t.slug),
      unique('tenants_api_key_hash_unique').on(t.apiKeyHash),
    ],
  },
);

export const tenantsTable = tenantsEntity.table;

export type Tenant = typeof tenantsTable.$inferSelect;

export const zTenantCreate = tenantsEntity.create;
