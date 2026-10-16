import type { PaymentProviderName } from '@/lib/payments/payment-provider-name';
import type { PaymentProvider } from '@/lib/payments/provider';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';
import type { ProviderConnection } from '@/lib/provider-connections/schema';

export type BuildProviderInput = {
  providerConnectionId: ProviderConnection['providerConnectionId'];
  provider: PaymentProviderName;
  credentials: string;
};

export type BuildProvider = (input: BuildProviderInput) => PaymentProvider;
export type ProviderFor = (connection: ProviderConnection) => Promise<PaymentProvider>;

export const providerForConnections =
  (cipher: CredentialCipher, buildProvider: BuildProvider): ProviderFor =>
  async ({ providerConnectionId, provider, sealedCredentials }) =>
    buildProvider({ providerConnectionId, provider, credentials: await cipher.open(sealedCredentials) });
