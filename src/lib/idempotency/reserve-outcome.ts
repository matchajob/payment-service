import type { IdempotencyKeyRow } from '@/lib/idempotency/schema';
import type { StoredResponse } from '@/lib/idempotency/stored-response';

export const RESERVE_OUTCOME = {
  RESERVED: 'reserved',
  REPLAY: 'replay',
  BODY_MISMATCH: 'body_mismatch',
  IN_FLIGHT: 'in_flight',
} as const;

export type ReserveResult =
  | { outcome: typeof RESERVE_OUTCOME.RESERVED; idempotencyKeyId: IdempotencyKeyRow['idempotencyKeyId'] }
  | { outcome: typeof RESERVE_OUTCOME.REPLAY; response: StoredResponse }
  | { outcome: typeof RESERVE_OUTCOME.BODY_MISMATCH }
  | { outcome: typeof RESERVE_OUTCOME.IN_FLIGHT };
