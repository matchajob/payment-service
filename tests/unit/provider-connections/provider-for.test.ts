import { describe, expect, it } from 'vitest';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { providerForConnections } from '@/lib/provider-connections/provider-for';
import { zProviderConnectionRead, type ProviderConnection } from '@/lib/provider-connections/schema';
import { fakeCredentialCipher, NOT_SEALED_BY_FAKE } from '@tests/utils/fake-credential-cipher';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { GROW_CREDENTIALS } from '@tests/utils/provider-credentials-fixtures';

const TAMPERED = 'sealed by someone else';

const connectionRow = (sealedCredentials: string): ProviderConnection => ({
  providerConnectionId: zProviderConnectionRead.shape.providerConnectionId.parse(
    '3b2f8a52-5f0e-4f7e-9a51-6c2b7e1d0a11',
  ),
  organizationId: zProviderConnectionRead.shape.organizationId.parse('9e4c1d7a-2b3f-4a5e-8c6d-7f0a1b2c3d4e'),
  provider: PAYMENT_PROVIDER.GROW,
  sealedCredentials,
  createdAt: new Date('2026-01-15T10:00:00.000Z'),
});

describe('providerForConnections (ADR 0010 amendment 3)', () => {
  it("opens the connection's sealed credentials and builds that connection's adapter", async () => {
    const cipher = fakeCredentialCipher();
    const factory = fakeProviderFactory();
    const connection = connectionRow(await cipher.seal(GROW_CREDENTIALS));
    const provider = await providerForConnections(cipher, factory.buildProvider)(connection);
    expect(factory.built).toEqual([
      {
        providerConnectionId: connection.providerConnectionId,
        provider: PAYMENT_PROVIDER.GROW,
        credentials: GROW_CREDENTIALS,
      },
    ]);
    expect(provider).toBe(factory.providerOf(connection.providerConnectionId));
  });

  it('fails without building anything when the credentials cannot be opened', async () => {
    const factory = fakeProviderFactory();
    const resolve = providerForConnections(fakeCredentialCipher(), factory.buildProvider)(connectionRow(TAMPERED));
    await expect(resolve).rejects.toThrow(NOT_SEALED_BY_FAKE);
    expect(factory.built).toEqual([]);
  });
});
