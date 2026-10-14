import { Hono } from 'hono';
import type { Logger } from 'pino';
import { HTTP_STATUS } from '@/api/http-status';
import { problemResponse } from '@/api/problem-response';
import { requestLogger } from '@/api/request-logger';
import { tenantAuth } from '@/api/tenant-auth';
import type { AppEnv } from '@/api/app-env';
import type { Database } from '@/lib/db';
import { plansRoutes } from '@/api/routes/plans';
import { customersRoutes } from '@/api/routes/customers';
import { dbContext } from '@/api/db-context';
import type { Clock } from '@/lib/clock';
import { idempotency } from '@/api/idempotency';
import { cronAuth } from '@/api/cron-auth';
import { cronRoutes } from '@/api/routes/cron';

export type AppDeps = { logger: Logger; db: Database; clock: Clock; cronSecret: string };

const V1 = '/v1/*';
const CRON_PREFIX = '/internal/cron';

export const createApp = ({ logger, db, clock, cronSecret }: AppDeps) => {
  const app = new Hono<AppEnv>();

  app.use(requestLogger(logger));
  app.use(dbContext(db));
  app.use(V1, tenantAuth());
  app.use(V1, idempotency(clock));
  app.use(`${CRON_PREFIX}/*`, cronAuth(cronSecret));

  app.route('/v1/plans', plansRoutes());
  app.route('/v1/customers', customersRoutes());
  app.route(CRON_PREFIX, cronRoutes(clock));

  app.get('/health', (c) => c.json({ ok: true }));
  app.notFound((c) => problemResponse(c, HTTP_STATUS.NOT_FOUND, c.req.path));
  app.onError((error, c) => {
    logger.error({ err: error, path: c.req.path }, 'unhandled');
    return problemResponse(c, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  });

  return app;
};
