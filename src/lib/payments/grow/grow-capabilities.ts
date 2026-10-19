import type { ProviderCapabilities } from '@/lib/payments/provider';

export const GROW_CAPABILITIES: ProviderCapabilities = {
  selfManagedSchedule: true,
  providerManagedSchedule: false,
  signedWebhooks: false,
  refunds: false,
  saveCardWithoutCharge: true,
  lookupByReference: true,
};
