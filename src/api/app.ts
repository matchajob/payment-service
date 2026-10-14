import { Hono } from 'hono';
import type { Logger } from 'pino';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { requestLogger } from '@/api/request-logger';
import { tenantAuth } from '@/api/tenant-auth';
import type { AppEnv } from '@/api/app-env';
import type { Database } from '@/lib/db';

export type AppDeps = { logger: Logger; db: Database };

export const createApp = ({ logger, db }: AppDeps) => {
  const app = new Hono<AppEnv>();
  app.use(requestLogger(logger));
  app.use('/v1/*', tenantAuth(db));
  app.get('/health', (c) => c.json({ ok: true }));
  app.notFound((c) => problemResponse(c, HTTP_STATUS.NOT_FOUND, 'Not Found', c.req.path));
  app.onError((error, c) => {
    logger.error({ err: error, path: c.req.path }, 'unhandled');
    return problemResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Internal Server Error');
  });
  return app;
};
