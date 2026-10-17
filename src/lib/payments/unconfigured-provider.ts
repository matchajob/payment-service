import type { PaymentProvider } from '@/lib/payments/provider';

const NOT_CONFIGURED = 'no payment provider is configured; the Grow adapter arrives in slice 13';

const notConfigured = async (): Promise<never> => {
  throw new Error(NOT_CONFIGURED);
};

export const unconfiguredProvider: PaymentProvider = {
  capabilities: {
    selfManagedSchedule: false,
    providerManagedSchedule: false,
    signedWebhooks: false,
    refunds: false,
    saveCardWithoutCharge: false,
    lookupByReference: false,
  },
  startCheckout: notConfigured,
  charge: notConfigured,
  verifyCharge: notConfigured,
  parseWebhook: () => {
    throw new Error(NOT_CONFIGURED);
  },
  verifyCheckout: notConfigured,
};
