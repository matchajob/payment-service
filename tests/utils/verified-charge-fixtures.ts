import { CURRENCY } from '@/lib/money/currency';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { MONTHLY } from '@tests/utils/plan-fixtures';

export const VERIFIED_CHARGE_REF = 'reconciled-charge-1';
export const VERIFIED_DECLINE_REASON = 'card expired';

export const VERIFIED_SUCCEEDED = {
  outcome: VERIFY_OUTCOME.SUCCEEDED,
  providerChargeRef: VERIFIED_CHARGE_REF,
  amountMinor: MONTHLY.amountMinor,
  currency: MONTHLY.currency,
} as const;

export const VERIFIED_WRONG_AMOUNT = { ...VERIFIED_SUCCEEDED, amountMinor: MONTHLY.amountMinor + 1 } as const;

export const VERIFIED_WRONG_CURRENCY = { ...VERIFIED_SUCCEEDED, currency: CURRENCY.USD } as const;

export const VERIFIED_FAILED = {
  outcome: VERIFY_OUTCOME.FAILED,
  providerChargeRef: VERIFIED_CHARGE_REF,
  reason: VERIFIED_DECLINE_REASON,
} as const;

export const VERIFIED_PENDING = { outcome: VERIFY_OUTCOME.PENDING } as const;

export const VERIFIED_NOT_FOUND = { outcome: VERIFY_OUTCOME.NOT_FOUND } as const;
