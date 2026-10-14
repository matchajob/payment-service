import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import type { Database } from '@/lib/db';
import { findTenantByApiKey } from '@/lib/tenants/find-tenant-by-api-key';

const BEARER_PREFIX = 'Bearer ';

const unauthorized = (c: Context) => problemResponse(c, HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');

export const tenantAuth =
  (db: Database): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const header = c.req.header('authorization');
    if (header === undefined || !header.startsWith(BEARER_PREFIX)) return unauthorized(c);
    const tenant = await findTenantByApiKey(db, header.slice(BEARER_PREFIX.length));
    if (tenant === undefined) return unauthorized(c);
    c.set('tenant', tenant);
    return next();
  };
