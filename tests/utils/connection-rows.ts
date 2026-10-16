import type { Database } from '@/lib/db';
import { createOrganization } from '@/lib/organizations/create-organization';
import type { Organization } from '@/lib/organizations/schema';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { providerConnectionsTable, type ProviderConnection } from '@/lib/provider-connections/schema';

export const TEST_ORGANIZATION = { name: 'Test Organization Ltd' };
export const SEALED_TEST_CREDENTIALS = 'fake-sealed:e30=';

export type SeededConnection = {
  organizationId: Organization['organizationId'];
  providerConnectionId: ProviderConnection['providerConnectionId'];
};

export const seedConnection = async (
  db: Database,
  organizationId?: Organization['organizationId'],
): Promise<SeededConnection> => {
  const owner = organizationId ?? (await createOrganization(db, TEST_ORGANIZATION)).organizationId;
  const [connection] = await db
    .insert(providerConnectionsTable)
    .values({ organizationId: owner, provider: PAYMENT_PROVIDER.GROW, sealedCredentials: SEALED_TEST_CREDENTIALS })
    .returning();
  if (connection === undefined) throw new Error('provider connection insert returned no row');
  return { organizationId: connection.organizationId, providerConnectionId: connection.providerConnectionId };
};
