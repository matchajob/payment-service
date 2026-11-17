import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { readBearerToken } from '@/api/bearer-token';
import type { CronTokenVerifier } from '@/api/cron-token-verifier';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';

export const cronAuth =
  (verifyCronToken: CronTokenVerifier): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const token = readBearerToken(c);
    if (token === undefined || !(await verifyCronToken(token))) {
      return problemResponse(c, HTTP_STATUS.UNAUTHORIZED);
    }
    return next();
  };
