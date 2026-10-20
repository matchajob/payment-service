import { describe, expect, it } from 'vitest';
import { assertProviderSupported } from '@/lib/payments/assert-provider-supported';
import { stripeUnderTest } from '@tests/utils/stripe-provider-under-test';

const EMPTY_SECRET_KEY = JSON.stringify({ secretKey: '' });
const MISSING_SECRET_KEY = JSON.stringify({});
const NOT_JSON = 'secretKey=sk_test_1';

describe('stripeProvider: capabilities (WORKPLAN slice 22, ADR 0020)', () => {
  it('is a self-managed, unsigned provider that saves a card without charging and looks up by our dedup key', () => {
    expect(stripeUnderTest().stripe.capabilities).toEqual({
      selfManagedSchedule: true,
      providerManagedSchedule: false,
      signedWebhooks: false,
      refunds: false,
      saveCardWithoutCharge: true,
      lookupByReference: true,
    });
  });

  it('passes the boot guard that refuses self-managed providers without a card-only save', () => {
    expect(() => assertProviderSupported(stripeUnderTest().stripe)).not.toThrow();
  });
});

describe('stripeProvider: merchant credentials (ADR 0020 decision 2)', () => {
  it.each([EMPTY_SECRET_KEY, MISSING_SECRET_KEY, NOT_JSON])('refuses credentials %s', (credentials) => {
    expect(() => stripeUnderTest(credentials)).toThrow();
  });
});
