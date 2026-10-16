import type { PaymentProvider } from '@/lib/payments/provider';
import type { BuildProvider, BuildProviderInput, ProviderFor } from '@/lib/provider-connections/provider-for';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import { fakePaymentProvider, type FakePaymentProvider } from '@tests/utils/fake-payment-provider';

type ConnectionId = ProviderConnection['providerConnectionId'];

export type FakeProviderFactory = {
  buildProvider: BuildProvider;
  providerFor: ProviderFor;
  providerOf: (providerConnectionId: ConnectionId) => FakePaymentProvider;
  built: BuildProviderInput[];
};

export const fakeProviderFactory = (): FakeProviderFactory => {
  const providers = new Map<ConnectionId, FakePaymentProvider>();
  const built: BuildProviderInput[] = [];

  const providerOf = (providerConnectionId: ConnectionId): FakePaymentProvider => {
    const existing = providers.get(providerConnectionId);
    if (existing !== undefined) return existing;
    const provider = fakePaymentProvider();
    providers.set(providerConnectionId, provider);
    return provider;
  };

  return {
    built,
    providerOf,
    buildProvider: (input) => {
      built.push(input);
      return providerOf(input.providerConnectionId);
    },
    providerFor: async ({ providerConnectionId }) => providerOf(providerConnectionId),
  };
};

export const everyConnection =
  (provider: PaymentProvider): ProviderFor =>
  async () =>
    provider;
