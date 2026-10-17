import type { CycleDecide } from '@/lib/charge-cycle/charge-cycle';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { dunningCycle } from '@/lib/dunning/dunning-cycle';
import { restartDunning } from '@/lib/dunning/restart-dunning';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';

export const immediateRetryDecide: CycleDecide = (settlement) =>
  settlement.result.outcome === CHARGE_STATUS.SUCCEEDED
    ? dunningCycle.decide(settlement)
    : {
        event: LIFECYCLE_EVENT.IMMEDIATE_RETRY_FAILED,
        changes: restartDunning(settlement.now, settlement.charge.attempt, settlement.parties.dunningScheduleDays),
      };
