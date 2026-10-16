import { CHARGE_STATUS } from '@/lib/charges/charge-status';

export const DECLINE_REASON = 'insufficient funds';
export const DECLINED = {
  outcome: CHARGE_STATUS.FAILED,
  providerChargeRef: undefined,
  reason: DECLINE_REASON,
} as const;
