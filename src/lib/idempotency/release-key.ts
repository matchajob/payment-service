import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { idempotencyKeysTable, type IdempotencyKeyRow } from '@/lib/idempotency/schema';

export const releaseKey = async (
  db: Database,
  idempotencyKeyId: IdempotencyKeyRow['idempotencyKeyId'],
): Promise<void> => {
  await db.delete(idempotencyKeysTable).where(eq(idempotencyKeysTable.idempotencyKeyId, idempotencyKeyId));
};
