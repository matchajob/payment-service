import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/db';
import type { Organization } from '@/lib/organizations/schema';
import { assertProviderSupported } from '@/lib/payments/assert-provider-supported';
import type { PaymentProviderName } from '@/lib/payments/payment-provider-name';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';
import type { BuildProvider } from '@/lib/provider-connections/provider-for';
import {
  providerConnectionsTable,
  zProviderConnectionRead,
  type ProviderConnectionView,
} from '@/lib/provider-connections/schema';

export type CreateProviderConnectionDeps = { cipher: CredentialCipher; buildProvider: BuildProvider };
export type CreateProviderConnectionInput = {
  organizationId: Organization['organizationId'];
  provider: PaymentProviderName;
  credentials: string;
};

export const createProviderConnection = async (
  db: Database,
  { cipher, buildProvider }: CreateProviderConnectionDeps,
  { organizationId, provider, credentials }: CreateProviderConnectionInput,
): Promise<ProviderConnectionView> => {
  const providerConnectionId = zProviderConnectionRead.shape.providerConnectionId.parse(randomUUID());
  assertProviderSupported(buildProvider({ providerConnectionId, provider, credentials }));
  const sealedCredentials = await cipher.seal(credentials);
  const [connection] = await db
    .insert(providerConnectionsTable)
    .values({ providerConnectionId, organizationId, provider, sealedCredentials })
    .returning();
  if (connection === undefined) throw new Error('provider connection insert returned no row');
  return zProviderConnectionRead.parse(connection);
};
