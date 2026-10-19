import type { GrowContext } from '@/lib/payments/grow/grow-context';
import { growDataOf } from '@/lib/payments/grow/grow-data-of';
import { GROW_METHOD } from '@/lib/payments/grow/grow-method';
import { zGrowTransactionRow, zTransactionRows } from '@/lib/payments/grow/grow-transaction-row';
import { decodeCardToken } from '@/lib/payments/grow/grow-card-token';
import { decodeChargeRef, encodeChargeRef } from '@/lib/payments/grow/grow-charge-ref';
import type { PaymentProvider, VerifiedCharge } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { verifiedFromRow } from '@/lib/payments/grow/verified-from-row';

const byRef = async ({ client, credentials }: GrowContext, providerChargeRef: string): Promise<VerifiedCharge> => {
  const { transactionId, transactionToken } = decodeChargeRef(providerChargeRef);
  const reply = await client.call(GROW_METHOD.GET_TRANSACTION_INFO, {
    pageCode: credentials.pageCode,
    transactionId,
    transactionToken,
  });
  return verifiedFromRow(growDataOf(GROW_METHOD.GET_TRANSACTION_INFO, reply, zGrowTransactionRow), providerChargeRef);
};

const bySerial = async (
  { client, credentials }: GrowContext,
  paymentMethodToken: string,
  chargeSerial: bigint,
): Promise<VerifiedCharge> => {
  const { cardToken } = decodeCardToken(paymentMethodToken);
  const reply = await client.call(GROW_METHOD.GET_TOKEN_TRANSACTIONS_BY_EXTERNAL_IDENTIFIERS, {
    userId: credentials.userId,
    cardToken,
    transactionUniqueIdentifier: String(chargeSerial),
  });
  const { transactions } = growDataOf(
    GROW_METHOD.GET_TOKEN_TRANSACTIONS_BY_EXTERNAL_IDENTIFIERS,
    reply,
    zTransactionRows,
  );
  const [row] = transactions;
  if (row === undefined) return { outcome: VERIFY_OUTCOME.NOT_FOUND };
  return verifiedFromRow(row, encodeChargeRef(row));
};

export const growVerifyCharge =
  (context: GrowContext): PaymentProvider['verifyCharge'] =>
  ({ providerChargeRef, paymentMethodToken, chargeSerial }) =>
    providerChargeRef === null
      ? bySerial(context, paymentMethodToken, chargeSerial)
      : byRef(context, providerChargeRef);
