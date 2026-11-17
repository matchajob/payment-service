import type { GcpKmsClient } from '@/infra/gcp-kms/gcp-kms-client';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

const FORMAT_PREFIX = 'kms-v1.';

export const NOT_KMS_SEALED = 'credentials were not sealed by the KMS cipher';

export const kmsCredentialCipher = (kms: GcpKmsClient): CredentialCipher => ({
  seal: async (plaintext, connectionId) => `${FORMAT_PREFIX}${await kms.encrypt(plaintext, connectionId)}`,
  open: async (sealed, connectionId) => {
    if (!sealed.startsWith(FORMAT_PREFIX)) throw new Error(NOT_KMS_SEALED);
    return kms.decrypt(sealed.slice(FORMAT_PREFIX.length), connectionId);
  },
});
