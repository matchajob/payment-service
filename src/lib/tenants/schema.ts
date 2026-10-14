import { z } from 'zod';
import { unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { dzdThemeBool } from '@matcha/infra/dzd/dzd-boolean';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { makeDzdJson } from '@matcha/infra/dzd/dzd-json';
import { dzdThemeStr } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid } from '@matcha/infra/dzd/dzd-uuid';

const MIN_CHECKOUT_TTL_HOURS = 1;

export const tenantsEntity = defineEntity(
  'tenants',
  {
    tenantId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'TenantId')),
    slug: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
    apiKeyHash: (f) => entityFromDzd(dzdThemeStr.hash(f)),
    webhookUrl: (f) => entityFromDzd(dzdThemeStr.nonEmpty.address(f)),
    webhookSecret: (f) => entityFromDzd(dzdThemeStr.nonEmpty.token(f)),
    checkoutTtlHours: (f) => entityFromDzd(makeDzdInteger(f, { minSize: MIN_CHECKOUT_TTL_HOURS })),
    resumeAllowed: (f) => entityFromDzd(dzdThemeBool.required(f)),
    graceEntitlement: (f) => entityFromDzd(dzdThemeBool.required(f)),
    dunningScheduleDays: (f) => entityFromDzd(makeDzdJson(f, z.array(z.int().positive()))),
    createdAt: (f) => entityFromDzd(dzdThemeTimestamp.defaultNow(f)),
  },
  {
    extraConstraints: (t) => [
      unique('tenants_slug_unique').on(t.slug),
      unique('tenants_api_key_hash_unique').on(t.apiKeyHash),
    ],
  },
);

export const tenantsTable = tenantsEntity.table;

export type Tenant = typeof tenantsTable.$inferSelect;
