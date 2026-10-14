import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';

export const requestLogger =
  (logger: Logger): MiddlewareHandler =>
  async (c, next) => {
    const startedAt = performance.now();
    await next();
    logger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      'request',
    );
  };
