import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { RESERVATION_TTL_MS } from '@/lib/idempotency/reservation-ttl';
import { idempotencyKeysTable, type IdempotencyKeyRow } from '@/lib/idempotency/schema';
import { toStoredResponse, type StoredResponse } from '@/lib/idempotency/stored-response';
import { RESERVE_OUTCOME, type ReserveResult } from '@/lib/idempotency/reserve-outcome';

export type ReserveInput = Pick<IdempotencyKeyRow, 'tenantId' | 'key' | 'requestHash'> & { now: Date };

const keys = idempotencyKeysTable;

const insertReservation = async (tx: Database, { now, ...input }: ReserveInput): Promise<ReserveResult> => {
  const [row] = await tx
    .insert(keys)
    .values({ ...input, reservedAt: now, responseBody: null })
    .onConflictDoNothing({ target: [keys.tenantId, keys.key] })
    .returning({ idempotencyKeysId: keys.idempotencyKeyId });
  if (row === undefined) return { outcome: RESERVE_OUTCOME.IN_FLIGHT };
  return { outcome: RESERVE_OUTCOME.RESERVED, idempotencyKeyId: row.idempotencyKeysId };
};

export const reserveKey = (db: Database, input: ReserveInput): Promise<ReserveResult> =>
  db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(keys)
      .where(and(eq(keys.tenantId, input.tenantId), eq(keys.key, input.key)))
      .for('update');
    if (existing === undefined) return insertReservation(tx, input);
    if (existing.requestHash !== input.requestHash) return { outcome: RESERVE_OUTCOME.BODY_MISMATCH };
    const response = toStoredResponse(existing);
    if (response !== undefined) return { outcome: RESERVE_OUTCOME.REPLAY, response };
    if (input.now.getTime() - existing.reservedAt.getTime() < RESERVATION_TTL_MS) {
      return { outcome: RESERVE_OUTCOME.IN_FLIGHT };
    }
    await tx.update(keys).set({ reservedAt: input.now }).where(eq(keys.idempotencyKeyId, existing.idempotencyKeyId));
    return { outcome: RESERVE_OUTCOME.RESERVED, idempotencyKeyId: existing.idempotencyKeyId };
  });
