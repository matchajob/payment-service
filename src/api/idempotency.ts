import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import type { Clock } from '@/lib/clock';
import { sha256Hex } from '@/lib/crypto/sha256-hex';
import { completeKey } from '@/lib/idempotency/complete-key';
import { releaseKey } from '@/lib/idempotency/release-key';
import { reserveKey } from '@/lib/idempotency/reserve-key';
import { RESERVE_OUTCOME } from '@/lib/idempotency/reserve-outcome';
import { zIdempotencyKeyRead } from '@/lib/idempotency/schema';
import { READ_METHODS } from '@/api/read-methods';

const KEY_HEADER = 'idempotency-key';
const RETRY_AFTER_HEADER = 'retry-after';
const RETRY_AFTER_SECONDS = '1';
const CONTENT_TYPE_HEADER = 'content-type';
const FALLBACK_CONTENT_TYPE = 'application/octet-stream';
const HANDLER_FAILED = Symbol('handler-failed');
const keySchema = zIdempotencyKeyRead.shape.key;

export const idempotency =
  (clock: Clock): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    if (READ_METHODS.has(c.req.method)) return next();

    const key = keySchema.safeParse(c.req.header(KEY_HEADER));
    if (!key.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, 'Idempotency-Key header must be a UUID');

    const db = c.get('db');
    const reservation = await reserveKey(db, {
      tenantId: c.get('tenant').tenantId,
      key: key.data,
      requestHash: sha256Hex(await c.req.text()),
      now: clock.now(),
    });

    if (reservation.outcome === RESERVE_OUTCOME.REPLAY) {
      const { status, contentType, body } = reservation.response;
      return new Response(body, { status, headers: { [CONTENT_TYPE_HEADER]: contentType } });
    }
    if (reservation.outcome === RESERVE_OUTCOME.BODY_MISMATCH) {
      return problemResponse(c, HTTP_STATUS.UNPROCESSABLE_CONTENT, 'Idempotency-Key was used with a different body');
    }
    if (reservation.outcome === RESERVE_OUTCOME.IN_FLIGHT) {
      c.header(RETRY_AFTER_HEADER, RETRY_AFTER_SECONDS);
      return problemResponse(c, HTTP_STATUS.CONFLICT, 'A request with this Idempotency-Key is in progress');
    }

    try {
      await db.transaction(async (tx) => {
        c.set('db', tx);
        await next();
        if (c.error !== undefined) throw HANDLER_FAILED;
        await completeKey(
          tx,
          reservation.idempotencyKeyId,
          {
            status: c.res.status,
            contentType: c.res.headers.get(CONTENT_TYPE_HEADER) ?? FALLBACK_CONTENT_TYPE,
            body: await c.res.clone().text(),
          },
          clock.now(),
        );
      });
    } catch (error) {
      if (error !== HANDLER_FAILED) throw error;
      await releaseKey(db, reservation.idempotencyKeyId);
    } finally {
      c.set('db', db);
    }
  };
