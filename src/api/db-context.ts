import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '@/api/app-env';
import type { Database } from '@/lib/db';

export const dbContext =
  (db: Database): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    c.set('db', db);
    return next();
  };
