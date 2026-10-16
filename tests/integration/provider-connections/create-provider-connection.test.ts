import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { createOrganization } from '@/lib/organizations/create-organization';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { createProviderConnection } from '@/lib/provider-connections/create-provider-connection';
import { providerConnectionsTable } from '@/lib/provider-connections/schema';
import { TEST_ORGANIZATION } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCredentialCipher } from '@tests/utils/fake-credential-cipher';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { GROW_CREDENTIALS, GROW_SECRET_API_KEY } from '@tests/utils/provider-credentials-fixtures';

const KMS_DOWN = 'kms unavailable';

const newConnection = async (db: Database) => {
  const { organizationId } = await createOrganization(db, TEST_ORGANIZATION);
  return { organizationId, provider: PAYMENT_PROVIDER.GROW, credentials: GROW_CREDENTIALS };
};

describe('createProviderConnection (ADR 0010 decision 3, amendments 2 and 3)', () => {
  it('stores the credentials sealed, never in plain text', async () => {
    await withRollback(testDb(), async (tx) => {
      const cipher = fakeCredentialCipher();
      const { buildProvider } = fakeProviderFactory();
      await createProviderConnection(tx, { cipher, buildProvider }, await newConnection(tx));
      const [row] = await tx.select().from(providerConnectionsTable);
      expect(row?.sealedCredentials).not.toContain(GROW_SECRET_API_KEY);
      expect(await cipher.open(row?.sealedCredentials ?? '')).toBe(GROW_CREDENTIALS);
    });
  });

  it("builds the adapter from the new connection's own id and plaintext credentials before storing it", async () => {
    await withRollback(testDb(), async (tx) => {
      const factory = fakeProviderFactory();
      const input = await newConnection(tx);
      const connection = await createProviderConnection(
        tx,
        { cipher: fakeCredentialCipher(), buildProvider: factory.buildProvider },
        input,
      );
      expect(factory.built).toEqual([
        {
          providerConnectionId: connection.providerConnectionId,
          provider: input.provider,
          credentials: GROW_CREDENTIALS,
        },
      ]);
      expect(connection).toMatchObject({ organizationId: input.organizationId, provider: input.provider });
    });
  });

  it('refuses a provider that cannot save a card without charging, and stores nothing (ADR 0007)', async () => {
    await withRollback(testDb(), async (tx) => {
      const safe = fakePaymentProvider();
      const unsafe = { ...safe, capabilities: { ...safe.capabilities, saveCardWithoutCharge: false } };
      const create = createProviderConnection(
        tx,
        { cipher: fakeCredentialCipher(), buildProvider: () => unsafe },
        await newConnection(tx),
      );
      await expect(create).rejects.toThrow(/saveCardWithoutCharge/);
      expect(await tx.$count(providerConnectionsTable)).toBe(0);
    });
  });

  it('stores nothing when the credentials cannot be sealed', async () => {
    await withRollback(testDb(), async (tx) => {
      const failingCipher = { ...fakeCredentialCipher(), seal: async () => Promise.reject(new Error(KMS_DOWN)) };
      const create = createProviderConnection(
        tx,
        { cipher: failingCipher, buildProvider: fakeProviderFactory().buildProvider },
        await newConnection(tx),
      );
      await expect(create).rejects.toThrow(KMS_DOWN);
      expect(await tx.$count(providerConnectionsTable)).toBe(0);
    });
  });
});
