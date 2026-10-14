import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';
import { createDb } from '@/lib/db';
import { systemClock } from '@/lib/clock';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';

const DEFAULT_PORT = 8080;
const DEFAULT_LOG_LEVEL = 'info';

const logger = pino({ level: process.env[ENV.LOG_LEVEL] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env[ENV.PORT] ?? DEFAULT_PORT);
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));
const cronSecret = readRequiredEnv(ENV.CRON_SECRET);

serve(
  { fetch: createApp({ logger, db, clock: systemClock, cronSecret, provider: unconfiguredProvider }).fetch, port },
  () => logger.info({ port }, 'listening'),
);
