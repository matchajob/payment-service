import { Hono } from 'hono';
import type { AppEnv } from '@/api/app-env';
import type { Clock } from '@/lib/clock';
import { runIdempotencyPurge } from '@/lib/idempotency/run-idempotency-purge';
import { drainOutbox } from '@/lib/outbox/drain-outbox';

export const cronRoutes = (clock: Clock) =>
  new Hono<AppEnv>()
    .post('/purge-idempotency', async (c) => c.json(await runIdempotencyPurge(c.get('db'), clock.now())))
    .post('/drain-outbox', async (c) => c.json(await drainOutbox(c.get('db'), clock.now()))
  );
