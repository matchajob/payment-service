import { CURRENCY } from '@/lib/money/currency';
import type { GrowTransactionRow } from '@/lib/payments/grow/grow-transaction-row';
import { GROW_STATUS_CODE } from '@/lib/payments/grow/grow-status-code';
import { fromGrowSum } from '@/lib/payments/grow/grow-sum';
import type { VerifiedCharge } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';

const DECLINED_STATUS_CODES: readonly string[] = [GROW_STATUS_CODE.DENIED, GROW_STATUS_CODE.CANCELLED];
const DECLINED_WITHOUT_STATUS = 'grow reports the transaction denied or cancelled';

export const verifiedFromRow = (row: GrowTransactionRow, providerChargeRef: string): VerifiedCharge => {
  if (row.statusCode === GROW_STATUS_CODE.PAID)
    return {
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef,
      amountMinor: fromGrowSum(row.sum),
      currency: CURRENCY.ILS,
    };
  if (DECLINED_STATUS_CODES.includes(row.statusCode))
    return { outcome: VERIFY_OUTCOME.FAILED, providerChargeRef, reason: row.status || DECLINED_WITHOUT_STATUS };
  return { outcome: VERIFY_OUTCOME.PENDING };
};
