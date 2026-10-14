import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';
import { createDb } from '@/lib/db';
import { systemClock } from '@/lib/clock';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';

const DEFAULT_PORT = 8080;
const DEFAULT_LOG_LEVEL = 'info';
const DATABASE_URL_ENV = 'DATABASE_URL';

const databaseUrl = process.env[DATABASE_URL_ENV];
if (databaseUrl === undefined) throw new Error(`${DATABASE_URL_ENV} is not set`);

const logger = pino({ level: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));
const cronSecret = readRequiredEnv(ENV.CRON_SECRET);

serve({ fetch: createApp({ logger, db, clock: systemClock, cronSecret }).fetch, port }, () =>
  logger.info({ port }, 'listening'),
);
