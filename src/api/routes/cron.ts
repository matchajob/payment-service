import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { AppEnv } from '@/api/app-env';
import type { Clock } from '@/lib/clock';
import { runIdempotencyPurge } from '@/lib/idempotency/run-idempotency-purge';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { runRenewal } from '@/lib/renewal/run-renewal';

export type CronRouteDeps = { clock: Clock; providerFor: ProviderFor; logger: Logger };

export const cronRoutes = ({ clock, providerFor, logger }: CronRouteDeps) =>
  new Hono<AppEnv>()
    .post('/purge-idempotency', async (c) => c.json(await runIdempotencyPurge(c.get('db'), clock.now())))
    .post('/drain-outbox', async (c) => c.json(await drainOutbox(c.get('db'), clock.now())))
    .post('/renew', async (c) =>
      c.json(await runRenewal({ db: c.get('db'), providerFor, batchLimit: RENEWAL_BATCH_LIMIT, logger }, clock.now())),
    );
