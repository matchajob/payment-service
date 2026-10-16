import pino from 'pino';
import { readRedriveArgs } from '@/cli/redrive-args';
import { systemClock } from '@/lib/clock';
import { createDb } from '@/lib/db';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { redriveDeadLetters } from '@/lib/outbox/redrive-dead-letters';

const ARGS_START = 2;

const filter = readRedriveArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));

const redriven = await redriveDeadLetters(db, filter, systemClock.now());
logger.warn({ ...filter, redriven }, 'redrove dead outbox events; the next drain delivers them');

await db.$client.end();
