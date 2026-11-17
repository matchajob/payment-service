import { describe, expect, it } from 'vitest';
import { invoicerForConnections } from '@/lib/invoicing-connections/invoicer-for';
import { zInvoicingConnectionRead } from '@/lib/invoicing-connections/schema';
import { INVOICING_SERVICE } from '@/lib/invoicing/invoicing-service-name';
import { CONNECTION_ID } from '@tests/utils/connection-ids';
import { fakeCredentialCipher } from '@tests/utils/fake-credential-cipher';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { MORNING_CREDENTIALS } from '@tests/utils/invoicing-credentials-fixtures';

describe('invoicerForConnections (invoicing port, ADR 0027)', () => {
  it("opens the credentials bound to the connection's own id and builds its adapter", async () => {
    const cipher = fakeCredentialCipher();
    const factory = fakeInvoicerFactory();
    const invoicingConnectionId = zInvoicingConnectionRead.shape.invoicingConnectionId.parse(CONNECTION_ID);
    const connection = {
      invoicingConnectionId,
      service: INVOICING_SERVICE.MORNING,
      sealedCredentials: await cipher.seal(MORNING_CREDENTIALS, CONNECTION_ID),
    };

    await invoicerForConnections(cipher, factory.buildInvoicer)(connection);

    expect(factory.built).toEqual([
      { invoicingConnectionId: CONNECTION_ID, service: INVOICING_SERVICE.MORNING, credentials: MORNING_CREDENTIALS },
    ]);
  });
});
