import { describe, expect, it } from 'vitest';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import { fakeCheckoutCompletedBody, fakePaymentProvider } from '@tests/utils/fake-payment-provider';

describe('fakePaymentProvider.parseWebhook', () => {
  it('recognizes its own checkout-completed body', () => {
    expect(fakePaymentProvider().parseWebhook(fakeCheckoutCompletedBody('sub-1', 'session-1'))).toEqual({
      kind: WEBHOOK_KIND.CHECKOUT_COMPLETED,
      reference: 'sub-1',
      sessionRef: 'session-1',
    });
  });

  it.each(['not json', '{}', '{"type":"something.else"}', ''])('calls %j unrecognized', (rawBody) => {
    expect(fakePaymentProvider().parseWebhook(rawBody)).toEqual({ kind: WEBHOOK_KIND.UNRECOGNIZED });
  });
});
