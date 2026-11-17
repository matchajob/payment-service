import type { Database } from '@/lib/db';
import { INVOICING_SERVICE } from '@/lib/invoicing/invoicing-service-name';
import { invoicingConnectionsTable, type InvoicingConnection } from '@/lib/invoicing-connections/schema';
import type { Organization } from '@/lib/organizations/schema';
import { SEALED_TEST_CREDENTIALS } from '@tests/utils/connection-rows';

export const seedInvoicingConnection = async (
  db: Database,
  organizationId: Organization['organizationId'],
  createdAt: Date = new Date(),
): Promise<InvoicingConnection> => {
  const [connection] = await db
    .insert(invoicingConnectionsTable)
    .values({
      organizationId,
      service: INVOICING_SERVICE.MORNING,
      sealedCredentials: SEALED_TEST_CREDENTIALS,
      createdAt,
    })
    .returning();
  if (connection === undefined) throw new Error('invoicing connection insert returned no row');
  return connection;
};
