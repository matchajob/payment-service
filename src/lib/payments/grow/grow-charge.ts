import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { assertGrowSerial } from '@/lib/payments/grow/assert-grow-serial';
import { assertIls } from '@/lib/payments/grow/assert-ils';
import type { GrowContext } from '@/lib/payments/grow/grow-context';
import { growDataOf } from '@/lib/payments/grow/grow-data-of';
import { GROW_METHOD } from '@/lib/payments/grow/grow-method';
import { zTokenCharge } from '@/lib/payments/grow/grow-token-charge';
import { decodeCardToken } from '@/lib/payments/grow/grow-card-token';
import { encodeChargeRef } from '@/lib/payments/grow/grow-charge-ref';
import { GROW_STATUS_CODE } from '@/lib/payments/grow/grow-status-code';
import { toGrowSum } from '@/lib/payments/grow/grow-sum';
import { GROW_FIELD, GROW_WIRE_VALUE } from '@/lib/payments/grow/grow-wire-values';
import type { PaymentProvider } from '@/lib/payments/provider';

const NOT_PAID = 'grow accepted the token charge but did not report it paid';

export const growCharge =
  ({ client, credentials }: GrowContext): PaymentProvider['charge'] =>
  async ({ paymentMethodToken, amountMinor, currency, chargeSerial }) => {
    assertIls(currency);
    assertGrowSerial(chargeSerial);
    const card = decodeCardToken(paymentMethodToken);
    const reply = await client.call(GROW_METHOD.CREATE_TRANSACTION_WITH_TOKEN, {
      userId: credentials.userId,
      cardToken: card.cardToken,
      sum: toGrowSum(amountMinor),
      paymentType: GROW_WIRE_VALUE.PAYMENT_TYPE_REGULAR,
      paymentNum: GROW_WIRE_VALUE.SINGLE_PAYMENT,
      [GROW_FIELD.PAYER_FULL_NAME]: card.fullName,
      [GROW_FIELD.PAYER_PHONE]: card.phone,
      transactionUniqueIdentifier: String(chargeSerial),
    });
    if (!reply.ok) return { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: reply.message };
    const charged = growDataOf(GROW_METHOD.CREATE_TRANSACTION_WITH_TOKEN, reply, zTokenCharge);
    if (charged.statusCode !== GROW_STATUS_CODE.PAID) throw new Error(NOT_PAID);
    return { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: encodeChargeRef(charged) };
  };
