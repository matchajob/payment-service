import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/db';
import { sha256Hex } from '@/lib/crypto/sha256-hex';
import { idempotencyKeysTable, zIdempotencyKeyRead } from '@/lib/idempotency/schema';
import type { Tenant } from '@/lib/tenants/schema';

const COMPLETED_STATUS = 201;
const COMPLETED_CONTENT_TYPE = 'application/json';

const base = (tenantId: Tenant['tenantId'], reservedAt: Date) => ({
  tenantId,
  key: zIdempotencyKeyRead.shape.key.parse(randomUUID()),
  requestHash: sha256Hex(randomUUID()),
  reservedAt,
});

export const insertReservedKey = async (db: Database, tenantId: Tenant['tenantId'], reservedAt: Date) => {
  await db.insert(idempotencyKeysTable).values({ ...base(tenantId, reservedAt), responseBody: null });
};

export const insertCompletedKey = async (db: Database, tenantId: Tenant['tenantId'], completedAt: Date) => {
  await db.insert(idempotencyKeysTable).values({
    ...base(tenantId, completedAt),
    completedAt,
    responseStatus: COMPLETED_STATUS,
    responseContentType: COMPLETED_CONTENT_TYPE,
    responseBody: '{}',
  });
};
