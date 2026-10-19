import { GROW_FIELD, GROW_WIRE_VALUE } from '@/lib/payments/grow/grow-wire-values';
import { encodeSessionRef } from '@/lib/payments/grow/grow-session-ref';
import type { PaymentProvider } from '@/lib/payments/provider';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';

export const growParseWebhook: PaymentProvider['parseWebhook'] = (rawBody) => {
  const form = new URLSearchParams(rawBody);
  const reference = form.get(GROW_FIELD.NOTIFY_REFERENCE);
  const processId = form.get(GROW_FIELD.NOTIFY_PROCESS_ID);
  const processToken = form.get(GROW_FIELD.NOTIFY_PROCESS_TOKEN);
  if (form.get(GROW_FIELD.NOTIFY_STATUS) !== GROW_WIRE_VALUE.NOTIFY_OK_STATUS)
    return { kind: WEBHOOK_KIND.UNRECOGNIZED };
  if (!reference || !processId || !processToken) return { kind: WEBHOOK_KIND.UNRECOGNIZED };
  return {
    kind: WEBHOOK_KIND.CHECKOUT_COMPLETED,
    reference,
    sessionRef: encodeSessionRef({ processId, processToken }),
  };
};
