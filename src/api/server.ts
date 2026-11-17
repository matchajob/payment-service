import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from '@/api/app';
import { gracefulShutdown } from '@/api/graceful-shutdown';
import { googleIdTokenKeys } from '@/infra/google-oidc/google-id-token-keys';
import { googleIdTokenVerifier } from '@/infra/google-oidc/google-id-token-verifier';
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
const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const;
const EXIT_OK = 0;
const EXIT_FAILED = 1;

const logger = pino({ level: process.env[ENV.LOG_LEVEL] ?? DEFAULT_LOG_LEVEL });
const port = Number(process.env[ENV.PORT] ?? DEFAULT_PORT);
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));
const verifyCronToken = googleIdTokenVerifier({
  audience: readRequiredEnv(ENV.CRON_AUDIENCE),
  email: readRequiredEnv(ENV.CRON_INVOKER_EMAIL),
  keys: googleIdTokenKeys(),
});
const cipher = selectCredentialCipher({
  kmsKeyName: process.env[ENV.PROVIDER_CREDENTIALS_KMS_KEY],
  localKey: process.env[ENV.PROVIDER_CREDENTIALS_LOCAL_KEY],
  fetch,
  clock: systemClock,
});
const providerFor = providerForConnections(cipher, buildProviderFrom(readProviderConfig()));

const server = serve(
  { fetch: createApp({ logger, db, clock: systemClock, verifyCronToken, providerFor }).fetch, port },
  () => logger.info({ port }, 'listening'),
);
const shutdown = gracefulShutdown({ server, closeDb: () => db.$client.end(), logger });

SHUTDOWN_SIGNALS.forEach((signal) =>
  process.once(signal, () =>
    shutdown().then(
      () => process.exit(EXIT_OK),
      (error: unknown) => {
        logger.error({ err: error, signal }, 'shutdown failed');
        process.exit(EXIT_FAILED);
      },
    ),
  ),
);
