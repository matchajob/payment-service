import { describe, expect, it } from 'vitest';
import { assertProviderSupported } from '@/lib/payments/assert-provider-supported';
import type { ProviderCapabilities } from '@/lib/payments/provider';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';

const UNSUPPORTED = /saveCardWithoutCharge/;

const providerWith = (overrides: Partial<ProviderCapabilities>) => {
  const provider = fakePaymentProvider();
  return { ...provider, capabilities: { ...provider.capabilities, ...overrides } };
};

describe('assertProviderSupported (ADR 0007)', () => {
  it('refuses a self-managed provider that cannot save a card without charging', () => {
    expect(() =>
      assertProviderSupported(providerWith({ selfManagedSchedule: true, saveCardWithoutCharge: false })),
    ).toThrow(UNSUPPORTED);
  });

  it('refuses it even when the provider supports refunds, because the fallback is not built', () => {
    expect(() =>
      assertProviderSupported(providerWith({ selfManagedSchedule: true, saveCardWithoutCharge: false, refunds: true })),
    ).toThrow(UNSUPPORTED);
  });

  it('accepts a self-managed provider that can save a card without charging', () => {
    expect(() =>
      assertProviderSupported(providerWith({ selfManagedSchedule: true, saveCardWithoutCharge: true })),
    ).not.toThrow();
  });

  it('accepts a provider that does not run our schedule, since it never uses our checkout', () => {
    expect(() =>
      assertProviderSupported(
        providerWith({ selfManagedSchedule: false, providerManagedSchedule: true, saveCardWithoutCharge: false }),
      ),
    ).not.toThrow();
  });
});
