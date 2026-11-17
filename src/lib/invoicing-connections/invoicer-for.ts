import type { Invoicer } from '@/lib/invoicing/invoicer';
import type { InvoicingServiceName } from '@/lib/invoicing/invoicing-service-name';
import type { InvoicingConnection } from '@/lib/invoicing-connections/schema';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

export type BuildInvoicerInput = {
  invoicingConnectionId: InvoicingConnection['invoicingConnectionId'];
  service: InvoicingServiceName;
  credentials: string;
};

export type BuildInvoicer = (input: BuildInvoicerInput) => Invoicer;
export type InvoicerFor = (
  connection: Pick<InvoicingConnection, 'invoicingConnectionId' | 'service' | 'sealedCredentials'>,
) => Promise<Invoicer>;

export const invoicerForConnections =
  (cipher: CredentialCipher, buildInvoicer: BuildInvoicer): InvoicerFor =>
  async ({ invoicingConnectionId, service, sealedCredentials }) =>
    buildInvoicer({
      invoicingConnectionId,
      service,
      credentials: await cipher.open(sealedCredentials, invoicingConnectionId),
    });
