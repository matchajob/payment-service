import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { providerConnectionsTable, type ProviderConnection } from '@/lib/provider-connections/schema';

export const findProviderConnection = async (
  db: Database,
  providerConnectionId: ProviderConnection['providerConnectionId'],
): Promise<ProviderConnection | undefined> => {
  const [connection] = await db
    .select()
    .from(providerConnectionsTable)
    .where(eq(providerConnectionsTable.providerConnectionId, providerConnectionId))
    .limit(1);
  return connection;
};
