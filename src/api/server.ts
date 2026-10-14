import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';
import { createDb } from '@/lib/db';

const DEFAULT_PORT = 8080;
const DEFAULT_LOG_LEVEL = 'info';

const databaseUrl = process.env['DATABASE_URL'];
if (databaseUrl === undefined) throw new Error('DATABASE_URL is not set');

const logger = pino({ level: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
const db = createDb(databaseUrl);

serve({ fetch: createApp({ logger, db }).fetch, port }, () => logger.info({ port }, 'listening'));
