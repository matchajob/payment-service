import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { createInvoicingConnection } from '@/lib/invoicing-connections/create-invoicing-connection';
import { invoicingConnectionsTable } from '@/lib/invoicing-connections/schema';
import { INVOICING_SERVICE } from '@/lib/invoicing/invoicing-service-name';
import { createOrganization } from '@/lib/organizations/create-organization';
import { TEST_ORGANIZATION } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCredentialCipher } from '@tests/utils/fake-credential-cipher';
import { fakeInvoicerFactory } from '@tests/utils/fake-invoicer-factory';
import { MORNING_API_SECRET, MORNING_CREDENTIALS } from '@tests/utils/invoicing-credentials-fixtures';

const KMS_DOWN = 'kms unavailable';
const MALFORMED = 'credentials are not a Morning API key';

const newConnection = async (db: Database) => {
  const { organizationId } = await createOrganization(db, TEST_ORGANIZATION);
  return { organizationId, service: INVOICING_SERVICE.MORNING, credentials: MORNING_CREDENTIALS };
};

describe('createInvoicingConnection (invoicing port, ADR 0027)', () => {
  it("stores the credentials sealed to the new connection's own id, never in plain text", async () => {
    await withRollback(testDb(), async (tx) => {
      const cipher = fakeCredentialCipher();
      const { buildInvoicer } = fakeInvoicerFactory();
      await createInvoicingConnection(tx, { cipher, buildInvoicer }, await newConnection(tx));
      const [row] = await tx.select().from(invoicingConnectionsTable);
      expect(row?.sealedCredentials).not.toContain(MORNING_API_SECRET);
      expect(await cipher.open(row?.sealedCredentials ?? '', row?.invoicingConnectionId ?? '')).toBe(
        MORNING_CREDENTIALS,
      );
    });
  });

  it('builds the adapter from the new id and the plaintext credentials before storing, and returns no secret', async () => {
    await withRollback(testDb(), async (tx) => {
      const factory = fakeInvoicerFactory();
      const input = await newConnection(tx);
      const connection = await createInvoicingConnection(
        tx,
        { cipher: fakeCredentialCipher(), buildInvoicer: factory.buildInvoicer },
        input,
      );
      expect(factory.built).toEqual([
        {
          invoicingConnectionId: connection.invoicingConnectionId,
          service: input.service,
          credentials: MORNING_CREDENTIALS,
        },
      ]);
      expect(connection).toEqual({
        invoicingConnectionId: expect.any(String),
        organizationId: input.organizationId,
        service: input.service,
        createdAt: expect.any(Date),
      });
    });
  });

  it('stores nothing when the adapter refuses the credentials', async () => {
    await withRollback(testDb(), async (tx) => {
      const create = createInvoicingConnection(
        tx,
        {
          cipher: fakeCredentialCipher(),
          buildInvoicer: () => {
            throw new Error(MALFORMED);
          },
        },
        await newConnection(tx),
      );
      await expect(create).rejects.toThrow(MALFORMED);
      expect(await tx.$count(invoicingConnectionsTable)).toBe(0);
    });
  });

  it('stores nothing when the credentials cannot be sealed', async () => {
    await withRollback(testDb(), async (tx) => {
      const failingCipher = { ...fakeCredentialCipher(), seal: async () => Promise.reject(new Error(KMS_DOWN)) };
      const create = createInvoicingConnection(
        tx,
        { cipher: failingCipher, buildInvoicer: fakeInvoicerFactory().buildInvoicer },
        await newConnection(tx),
      );
      await expect(create).rejects.toThrow(KMS_DOWN);
      expect(await tx.$count(invoicingConnectionsTable)).toBe(0);
    });
  });
});
