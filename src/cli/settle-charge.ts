import pino from 'pino';
import { readSettleChargeArgs } from '@/cli/settle-charge-args';
import { SETTLE_COMMAND } from '@/cli/settle-command';
import { systemClock } from '@/lib/clock';
import { createDb } from '@/lib/db';
import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import { resolveFlaggedCharge } from '@/lib/reconcile/resolve-flagged-charge';
import { settleFlaggedCharge } from '@/lib/reconcile/settle-flagged-charge';
import { SETTLE_FLAGGED, type SettleFlaggedOutcome } from '@/lib/reconcile/settle-flagged-outcome';

const ARGS_START = 2;
const NOT_SETTLED_EXIT_CODE = 1;
const DONE: ReadonlySet<SettleFlaggedOutcome> = new Set([
  SETTLE_FLAGGED.SETTLED,
  SETTLE_FLAGGED.SETTLED_NEEDS_REFUND,
  SETTLE_FLAGGED.RESOLVED,
]);

const command = readSettleChargeArgs(process.argv.slice(ARGS_START));
const logger = pino();
const db = createDb(readRequiredEnv(ENV.DATABASE_URL));

const outcome =
  command.kind === SETTLE_COMMAND.RESOLVE
    ? await resolveFlaggedCharge(db, command, systemClock.now())
    : await settleFlaggedCharge(db, command, systemClock.now());
logger.warn({ chargeId: command.chargeId, command: command.kind, outcome }, 'manual charge settlement');
if (outcome === SETTLE_FLAGGED.SETTLED_NEEDS_REFUND)
  logger.error(
    { chargeId: command.chargeId },
    'the customer paid after the subscription was canceled: refund at the provider, then run --resolve',
  );
if (!DONE.has(outcome)) process.exitCode = NOT_SETTLED_EXIT_CODE;

await db.$client.end();
