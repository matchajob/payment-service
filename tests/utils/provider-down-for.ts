import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { ProviderConnection } from '@/lib/provider-connections/schema';
import type { FakeProviderFactory } from '@tests/utils/fake-provider-factory';

const PROVIDER_DOWN = 'provider cannot be built: credentials unreadable';

export const providerDownFor =
  (providers: FakeProviderFactory, down: ProviderConnection['providerConnectionId']): ProviderFor =>
  async (connection) =>
    connection.providerConnectionId === down
      ? Promise.reject(new Error(PROVIDER_DOWN))
      : providers.providerFor(connection);
