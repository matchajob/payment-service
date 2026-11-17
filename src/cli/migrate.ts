import { migrate } from 'drizzle-orm/postgres-js/migrator';
import pino from 'pino';
import { createDb } from '@/lib/db';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';

const MIGRATIONS_FOLDER = 'drizzle';

const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));

await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
logger.info({ migrationsFolder: MIGRATIONS_FOLDER }, 'migrations applied');

await db.$client.end();
