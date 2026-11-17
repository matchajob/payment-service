import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

const SEALED_PREFIX = 'fake-sealed:';
const BINDING_END = ':';
const ENCODING = 'base64';

export const NOT_SEALED_BY_FAKE = 'fakeCredentialCipher: not sealed by this cipher for this connection';

const prefixFor = (connectionId: string) => `${SEALED_PREFIX}${connectionId}${BINDING_END}`;

export const fakeCredentialCipher = (): CredentialCipher => ({
  seal: async (plaintext, connectionId) => `${prefixFor(connectionId)}${Buffer.from(plaintext).toString(ENCODING)}`,
  open: async (sealed, connectionId) => {
    if (!sealed.startsWith(prefixFor(connectionId))) throw new Error(NOT_SEALED_BY_FAKE);
    return Buffer.from(sealed.slice(prefixFor(connectionId).length), ENCODING).toString();
  },
});
