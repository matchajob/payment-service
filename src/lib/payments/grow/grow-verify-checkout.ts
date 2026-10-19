import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import type { GrowContext } from '@/lib/payments/grow/grow-context';
import { growDataOf } from '@/lib/payments/grow/grow-data-of';
import { GROW_METHOD } from '@/lib/payments/grow/grow-method';
import { zTransactionRows } from '@/lib/payments/grow/grow-transaction-row';
import { encodeCardToken } from '@/lib/payments/grow/grow-card-token';
import { decodeSessionRef } from '@/lib/payments/grow/grow-session-ref';
import { GROW_STATUS_CODE } from '@/lib/payments/grow/grow-status-code';
import type { PaymentProvider } from '@/lib/payments/provider';

const NO_PAYER = 'grow saved a card without the payer name and phone a token charge needs (ADR 0019 decision 3)';

export const growVerifyCheckout =
  ({ client, credentials }: GrowContext): PaymentProvider['verifyCheckout'] =>
  async (sessionRef) => {
    const { processId, processToken } = decodeSessionRef(sessionRef);
    const reply = await client.call(GROW_METHOD.GET_PAYMENT_PROCESS_INFO, {
      pageCode: credentials.pageCode,
      processId,
      processToken,
    });
    const { transactions } = growDataOf(GROW_METHOD.GET_PAYMENT_PROCESS_INFO, reply, zTransactionRows);
    const saved = transactions.find(
      ({ statusCode, cardToken }) => statusCode === GROW_STATUS_CODE.SUSPENDED && cardToken !== '',
    );
    if (saved === undefined) return { outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED };
    if (saved.fullName === '' || saved.payerPhone === '') throw new Error(NO_PAYER);
    return {
      outcome: CHECKOUT_VERIFICATION.CARD_SAVED,
      paymentMethodToken: encodeCardToken({
        cardToken: saved.cardToken,
        fullName: saved.fullName,
        phone: saved.payerPhone,
      }),
    };
  };
