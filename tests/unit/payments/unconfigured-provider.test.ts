import { describe, expect, it } from 'vitest';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import { CURRENCY } from '@/lib/money/currency';
import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';

const NOT_CONFIGURED = /no payment provider is configured/;

describe('unconfiguredProvider', () => {
  it('claims no capabilities', () => {
    expect(Object.values(unconfiguredProvider.capabilities).every((capable) => !capable)).toBe(true);
  });

  it('refuses every call with an error that says why', async () => {
    await expect(
      unconfiguredProvider.startCheckout({
        mode: CHECKOUT_MODE.CHARGE,
        reference: 'sub-1',
        amountMinor: 4900,
        currency: CURRENCY.ILS,
        returnUrl: 'https://tenant.test/return',
      }),
    ).rejects.toThrow(NOT_CONFIGURED);
    await expect(
      unconfiguredProvider.charge({ paymentMethodToken: 'token', amountMinor: 4900, dedupKey: 'dedup' }),
    ).rejects.toThrow(NOT_CONFIGURED);
    await expect(unconfiguredProvider.verifyCharge('charge-ref')).rejects.toThrow(NOT_CONFIGURED);
  });
});
