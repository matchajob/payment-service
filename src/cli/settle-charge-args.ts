import { parseArgs } from 'node:util';
import { z } from 'zod';
import { SETTLE_COMMAND } from '@/cli/settle-command';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { zChargeRead } from '@/lib/charges/schema';
import type { ResolveFlagInput } from '@/lib/reconcile/resolve-flagged-charge';
import type { SettleFlaggedInput } from '@/lib/reconcile/settle-flagged-charge';

const NON_EMPTY = 1;
const ONE_ACTION = 1;
const USAGE =
  'pass --charge <chargeId> and exactly one of --succeeded <providerChargeRef>, --failed <reason> or --resolve <reason>';

const chargeArgsSchema = zChargeRead.pick({ chargeId: true });
const detailSchema = z.string().min(NON_EMPTY);

export type SettleChargeCommand =
  | ({ kind: typeof SETTLE_COMMAND.SETTLE } & SettleFlaggedInput)
  | ({ kind: typeof SETTLE_COMMAND.RESOLVE } & ResolveFlagInput);

export const readSettleChargeArgs = (argv: string[]): SettleChargeCommand => {
  const { values } = parseArgs({
    args: argv,
    options: {
      charge: { type: 'string' },
      succeeded: { type: 'string' },
      failed: { type: 'string' },
      resolve: { type: 'string' },
    },
  });
  const actions = [values.succeeded, values.failed, values.resolve].filter((value) => value !== undefined);
  if (actions.length !== ONE_ACTION) throw new Error(USAGE);
  const { chargeId } = chargeArgsSchema.parse({ chargeId: values.charge });
  if (values.resolve !== undefined)
    return { kind: SETTLE_COMMAND.RESOLVE, chargeId, resolution: detailSchema.parse(values.resolve) };
  if (values.succeeded !== undefined)
    return {
      kind: SETTLE_COMMAND.SETTLE,
      chargeId,
      result: { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: detailSchema.parse(values.succeeded) },
    };
  return {
    kind: SETTLE_COMMAND.SETTLE,
    chargeId,
    result: { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: detailSchema.parse(values.failed) },
  };
};
