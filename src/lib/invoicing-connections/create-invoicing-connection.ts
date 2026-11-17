import { randomUUID } from 'node:crypto';
import type { Database } from '@/lib/db';
import type { InvoicingServiceName } from '@/lib/invoicing/invoicing-service-name';
import type { BuildInvoicer } from '@/lib/invoicing-connections/invoicer-for';
import {
  invoicingConnectionsTable,
  zInvoicingConnectionRead,
  type InvoicingConnectionView,
} from '@/lib/invoicing-connections/schema';
import type { Organization } from '@/lib/organizations/schema';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

const NO_ROW = 'invoicing connection insert returned no row';

export type CreateInvoicingConnectionDeps = { cipher: CredentialCipher; buildInvoicer: BuildInvoicer };
export type CreateInvoicingConnectionInput = {
  organizationId: Organization['organizationId'];
  service: InvoicingServiceName;
  credentials: string;
};

export const createInvoicingConnection = async (
  db: Database,
  { cipher, buildInvoicer }: CreateInvoicingConnectionDeps,
  { organizationId, service, credentials }: CreateInvoicingConnectionInput,
): Promise<InvoicingConnectionView> => {
  const invoicingConnectionId = zInvoicingConnectionRead.shape.invoicingConnectionId.parse(randomUUID());
  buildInvoicer({ invoicingConnectionId, service, credentials });
  const sealedCredentials = await cipher.seal(credentials, invoicingConnectionId);
  const [connection] = await db
    .insert(invoicingConnectionsTable)
    .values({ invoicingConnectionId, organizationId, service, sealedCredentials })
    .returning();
  if (connection === undefined) throw new Error(NO_ROW);
  return zInvoicingConnectionRead.parse(connection);
};
