import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';
import { createDb } from '@/lib/db';
import { systemClock } from '@/lib/clock';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { providerForConnections } from '@/lib/provider-connections/provider-for';
import { selectCredentialCipher } from '@/lib/provider-connections/select-credential-cipher';
import { buildProviderFrom } from '@/lib/provider-connections/build-provider';
import { readProviderConfig } from '@/lib/provider-connections/read-provider-config';

const DEFAULT_PORT = 8080;
const DEFAULT_LOG_LEVEL = 'info';

const logger = pino({ level: process.env[ENV.LOG_LEVEL] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env[ENV.PORT] ?? DEFAULT_PORT);
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));
const cronSecret = readRequiredEnv(ENV.CRON_SECRET);
const cipher = selectCredentialCipher({
  kmsKeyName: process.env[ENV.PROVIDER_CREDENTIALS_KMS_KEY],
  localKey: process.env[ENV.PROVIDER_CREDENTIALS_LOCAL_KEY],
});
const providerFor = providerForConnections(cipher, buildProviderFrom(readProviderConfig()));

serve({ fetch: createApp({ logger, db, clock: systemClock, cronSecret, providerFor }).fetch, port }, () =>
  logger.info({ port }, 'listening'),
);
