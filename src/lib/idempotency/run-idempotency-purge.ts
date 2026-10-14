import { lt } from 'drizzle-orm';
import type { CronSummary } from '@/lib/cron/cron-summary';
import type { Database } from '@/lib/db';
import { COMPLETED_KEY_TTL_MS } from '@/lib/idempotency/completed-key-ttl';
import { idempotencyKeysTable } from '@/lib/idempotency/schema';

export const runIdempotencyPurge = async (db: Database, now: Date): Promise<CronSummary> => {
  const cutoff = new Date(now.getTime() - COMPLETED_KEY_TTL_MS);
  const purged = await db
    .delete(idempotencyKeysTable)
    .where(lt(idempotencyKeysTable.completedAt, cutoff))
    .returning({ idempotencyKeyId: idempotencyKeysTable.idempotencyKeyId });
  return { processed: purged.length, failed: 0 };
};
