import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';

const DEFAULT_PORT = 8080;
const DEFAULT_LOG_LEVEL = 'info';

const logger = pino({ level: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env['PORT'] ?? DEFAULT_PORT);

serve({ fetch: createApp({ logger }).fetch, port }, () => logger.info({ port }, 'listening'));
