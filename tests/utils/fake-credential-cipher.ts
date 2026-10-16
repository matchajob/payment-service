import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

const SEALED_PREFIX = 'fake-sealed:';
const ENCODING = 'base64';

export const NOT_SEALED_BY_FAKE = 'fakeCredentialCipher: not sealed by this cipher';

export const fakeCredentialCipher = (): CredentialCipher => ({
  seal: async (plaintext) => `${SEALED_PREFIX}${Buffer.from(plaintext).toString(ENCODING)}`,
  open: async (sealed) => {
    if (!sealed.startsWith(SEALED_PREFIX)) throw new Error(NOT_SEALED_BY_FAKE);
    return Buffer.from(sealed.slice(SEALED_PREFIX.length), ENCODING).toString();
  },
});
