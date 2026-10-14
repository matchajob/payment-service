import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { readBearerToken } from '@/api/bearer-token';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { findTenantByApiKey } from '@/lib/tenants/find-tenant-by-api-key';

const unauthorized = (c: Context) => problemResponse(c, HTTP_STATUS.UNAUTHORIZED);

export const tenantAuth = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const token = readBearerToken(c);
  if (token === undefined) return unauthorized(c);
  const tenant = await findTenantByApiKey(c.get('db'), token);
  if (tenant === undefined) return unauthorized(c);
  c.set('tenant', tenant);
  return next();
};
