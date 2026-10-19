import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { assertIls } from '@/lib/payments/grow/assert-ils';
import type { GrowContext } from '@/lib/payments/grow/grow-context';
import { growDataOf } from '@/lib/payments/grow/grow-data-of';
import { GROW_METHOD } from '@/lib/payments/grow/grow-method';
import { zCreatedProcess } from '@/lib/payments/grow/grow-created-process';
import { encodeSessionRef } from '@/lib/payments/grow/grow-session-ref';
import { GROW_FIELD, GROW_WIRE_VALUE } from '@/lib/payments/grow/grow-wire-values';
import type { PaymentProvider } from '@/lib/payments/provider';

const CAPTURE_ONLY = 'grow checkouts only save a card; v1 never starts a charge-mode checkout (ADR 0007)';

export const growStartCheckout =
  ({ client, credentials, notifyUrl }: GrowContext): PaymentProvider['startCheckout'] =>
  async ({ mode, reference, currency, returnUrl }) => {
    if (mode !== CHECKOUT_MODE.CAPTURE) throw new Error(CAPTURE_ONLY);
    assertIls(currency);
    const reply = await client.call(GROW_METHOD.CREATE_PAYMENT_PROCESS, {
      userId: credentials.userId,
      pageCode: credentials.pageCode,
      chargeType: GROW_WIRE_VALUE.CHARGE_TYPE_CREATE_TOKEN,
      saveCardToken: GROW_WIRE_VALUE.SAVE_CARD_TOKEN,
      sum: GROW_WIRE_VALUE.TOKEN_ONLY_SUM,
      successUrl: returnUrl,
      cancelUrl: returnUrl,
      notifyUrl,
      [GROW_FIELD.REFERENCE]: reference,
    });
    const created = growDataOf(GROW_METHOD.CREATE_PAYMENT_PROCESS, reply, zCreatedProcess);
    return { checkoutUrl: created.url, providerSessionRef: encodeSessionRef(created) };
  };
