import { ENV } from '@/lib/env-names';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';
import { localCredentialCipher } from '@/lib/provider-connections/local-credential-cipher';

export const KMS_CIPHER_PENDING = `${ENV.PROVIDER_CREDENTIALS_KMS_KEY} is set, but the KMS cipher arrives in slice 20; the local key is never used here`;
export const LOCAL_KEY_MISSING = `${ENV.PROVIDER_CREDENTIALS_LOCAL_KEY} is not set`;

export type CipherSettings = { kmsKeyName: string | undefined; localKey: string | undefined };

const kmsCipherPending: CredentialCipher = {
  seal: async () => Promise.reject(new Error(KMS_CIPHER_PENDING)),
  open: async () => Promise.reject(new Error(KMS_CIPHER_PENDING)),
};

export const selectCredentialCipher = ({ kmsKeyName, localKey }: CipherSettings): CredentialCipher => {
  if (kmsKeyName !== undefined) return kmsCipherPending;
  if (localKey === undefined) throw new Error(LOCAL_KEY_MISSING);
  return localCredentialCipher(localKey);
};
