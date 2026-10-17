import pino from 'pino';
import { readSettleChargeArgs } from '@/cli/settle-charge-args';
import { systemClock } from '@/lib/clock';
import { createDb } from '@/lib/db';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { settleFlaggedCharge } from '@/lib/reconcile/settle-flagged-charge';
import { SETTLE_FLAGGED } from '@/lib/reconcile/settle-flagged-outcome';

const ARGS_START = 2;
const NOT_SETTLED_EXIT_CODE = 1;

const input = readSettleChargeArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));

const settled = await settleFlaggedCharge(db, input, systemClock.now());
logger.warn({ chargeId: input.chargeId, outcome: input.result.outcome, settled }, 'manual charge settlement');
if (settled !== SETTLE_FLAGGED.SETTLED) process.exitCode = NOT_SETTLED_EXIT_CODE;

await db.$client.end();
