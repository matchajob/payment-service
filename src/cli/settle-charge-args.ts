import { parseArgs } from 'node:util';
import { z } from 'zod';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { zChargeRead } from '@/lib/charges/schema';
import type { SettleFlaggedInput } from '@/lib/reconcile/settle-flagged-charge';

const NON_EMPTY = 1;
const USAGE = 'pass --charge <chargeId> and exactly one of --succeeded <providerChargeRef> or --failed <reason>';

const chargeArgsSchema = zChargeRead.pick({ chargeId: true });
const detailSchema = z.string().min(NON_EMPTY);

export const readSettleChargeArgs = (argv: string[]): SettleFlaggedInput => {
  const { values } = parseArgs({
    args: argv,
    options: { charge: { type: 'string' }, succeeded: { type: 'string' }, failed: { type: 'string' } },
  });
  if ((values.succeeded === undefined) === (values.failed === undefined)) throw new Error(USAGE);
  const { chargeId } = chargeArgsSchema.parse({ chargeId: values.charge });
  if (values.succeeded !== undefined)
    return {
      chargeId,
      result: { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: detailSchema.parse(values.succeeded) },
    };
  return {
    chargeId,
    result: { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: detailSchema.parse(values.failed) },
  };
};
