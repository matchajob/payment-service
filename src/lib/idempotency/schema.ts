import { sql } from 'drizzle-orm';
import { check, unique } from '@matcha/infra/domain-drizzle/exports';
import { defineEntity } from '@matcha/infra/domain-ef/define-entity';
import { entityFromDzd } from '@matcha/infra/domain-ef/entity-from-dzd';
import { DZD_NULLABLE } from '@matcha/infra/dzd/dzd-config';
import { makeDzdInteger } from '@matcha/infra/dzd/dzd-integer';
import { dzdThemeStr, makeDzdString } from '@matcha/infra/dzd/dzd-string';
import { dzdThemeTimestamp } from '@matcha/infra/dzd/dzd-timestamp';
import { dzdThemeUuid, makeDzdUuid } from '@matcha/infra/dzd/dzd-uuid';
import { StrMaxSizes, StrMinSizes } from '@matcha/infra/validations/z-string';
import { REFERENTIAL_ACTION } from '@/lib/referential-action';
import { tenantsTable } from '@/lib/tenants/schema';

const MIN_HTTP_STATUS = 100;
const MAX_HTTP_STATUS = 599;

export const idempotencyKeysEntity = defineEntity(
  'idempotency_keys',
  {
    idempotencyKeyId: (f) => entityFromDzd(dzdThemeUuid.primaryKey(f, 'IdempotencyKeyId')),
    tenantId: (f) =>
      entityFromDzd(
        dzdThemeUuid.requiredRef(
          f,
          { ref: () => tenantsTable.tenantId, actions: { onDelete: REFERENTIAL_ACTION.CASCADE } },
          'TenantId',
        ),
      ),
    key: (f) => entityFromDzd(makeDzdUuid(f, 'IdempotencyKey')),
    requestHash: (f) => entityFromDzd(dzdThemeStr.hash(f)),
    reservedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f)),
    completedAt: (f) => entityFromDzd(dzdThemeTimestamp.custom(f), DZD_NULLABLE),
    responseStatus: (f) =>
      entityFromDzd(makeDzdInteger(f, { minSize: MIN_HTTP_STATUS, maxSize: MAX_HTTP_STATUS }), DZD_NULLABLE),
    responseContentType: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f), DZD_NULLABLE),
    responseBody: (f) =>
      entityFromDzd(makeDzdString(f, { maxSize: StrMaxSizes.blob, minSize: StrMinSizes.empty }), DZD_NULLABLE),
  },
  {
    extraConstraints: (t) => [
      unique('idempotency_keys_tenant_key_unique').on(t.tenantId, t.key),
      check(
        'idempotency_keys_completion_is_whole',
        sql`(${t.completedAt} is null) = (${t.responseStatus} is null)
          and (${t.completedAt} is null) = (${t.responseContentType} is null)
          and (${t.completedAt} is null) = (${t.responseBody} is null)`,
      ),
    ],
  },
);

export const idempotencyKeysTable = idempotencyKeysEntity.table;
export const zIdempotencyKeyRead = idempotencyKeysEntity.read;

export type IdempotencyKeyRow = typeof idempotencyKeysTable.$inferSelect;
