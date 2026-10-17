import type { Database } from '@/lib/db';
import type { PaymentProvider } from '@/lib/payments/provider';
import { findProviderConnection } from '@/lib/provider-connections/find-provider-connection';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { ProviderConnection } from '@/lib/provider-connections/schema';

const MISSING_CONNECTION = 'charge references a missing provider connection';

export const providerForConnectionId = async (
  db: Database,
  providerFor: ProviderFor,
  providerConnectionId: ProviderConnection['providerConnectionId'],
): Promise<PaymentProvider> => {
  const connection = await findProviderConnection(db, providerConnectionId);
  if (connection === undefined) throw new Error(MISSING_CONNECTION);
  return providerFor(connection);
};
