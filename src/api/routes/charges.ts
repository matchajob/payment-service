import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { unknownCursorResponse } from '@/api/unknown-cursor-response';
import { chargeListQuerySchema } from '@/contract/charge-list-query';
import type { ChargeListResponse } from '@/contract/charge-list-response';
import { listCharges } from '@/lib/charges/list-charges';
import { zChargeRead } from '@/lib/charges/schema';
import { LIST_OUTCOME } from '@/lib/pagination/list-result';

const listQuery = chargeListQuerySchema.extend({ startingAfter: zChargeRead.shape.chargeId.optional() });

export const chargesRoutes = () =>
  new Hono<AppEnv>().get('/', async (c) => {
    const query = listQuery.safeParse(c.req.query());
    if (!query.success) return problemResponse(c, HTTP_STATUS.BAD_REQUEST, query.error.message);
    const result = await listCharges(c.get('db'), c.get('tenant').tenantId, query.data);
    if (result.outcome === LIST_OUTCOME.UNKNOWN_CURSOR) return unknownCursorResponse(c);
    const body: ChargeListResponse = {
      hasMore: result.hasMore,
      data: result.items.map((charge) => ({
        chargeId: charge.chargeId,
        subscriptionId: charge.subscriptionId,
        kind: charge.kind,
        amountMinor: charge.amountMinor,
        currency: charge.currency,
        status: charge.status,
        failureReason: charge.failureReason,
        attemptedAt: charge.attemptedAt.toISOString(),
      })),
    };
    return c.json(body);
  });
