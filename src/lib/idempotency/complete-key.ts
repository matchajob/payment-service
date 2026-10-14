import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { idempotencyKeysTable, type IdempotencyKeyRow } from '@/lib/idempotency/schema';
import type { StoredResponse } from '@/lib/idempotency/stored-response';

export const completeKey = async (
  db: Database,
  idempotencyKeyId: IdempotencyKeyRow['idempotencyKeyId'],
  response: StoredResponse,
  now: Date,
): Promise<void> => {
  await db
    .update(idempotencyKeysTable)
    .set({
      completedAt: now,
      responseStatus: response.status,
      responseContentType: response.contentType,
      responseBody: response.body,
    })
    .where(eq(idempotencyKeysTable.idempotencyKeyId, idempotencyKeyId));
};
