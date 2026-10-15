import { describe, expect, it } from 'vitest';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';

describe('fakePaymentProvider.verifyCheckout', () => {
  it('reports a saved card with a token tied to the session by default', async () => {
    const provider = fakePaymentProvider();
    expect(await provider.verifyCheckout('session-1')).toEqual({
      outcome: CHECKOUT_VERIFICATION.CARD_SAVED,
      paymentMethodToken: 'token-session-1',
    });
    expect(provider.calls.verifyCheckout).toEqual(['session-1']);
  });

  it('can be scripted to report an unfinished checkout', async () => {
    const provider = fakePaymentProvider();
    provider.scriptCheckoutNotCompleted();
    expect(await provider.verifyCheckout('session-1')).toEqual({ outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED });
  });
});
