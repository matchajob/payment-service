import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import { readBearerToken } from '@/api/bearer-token';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { sha256Hex } from '@/lib/crypto/sha256-hex';

const NO_TOKEN = '';

const digest = (value: string) => Buffer.from(sha256Hex(value));

export const cronAuth =
  (cronSecret: string): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const presented = readBearerToken(c) ?? NO_TOKEN;
    if (!timingSafeEqual(digest(presented), digest(cronSecret))) {
      return problemResponse(c, HTTP_STATUS.UNAUTHORIZED);
    }
    return next();
  };
