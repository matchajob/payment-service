import { gcpKmsClient } from '@/infra/gcp-kms/gcp-kms-client';
import { metadataAccessToken } from '@/infra/gcp-kms/metadata-access-token';
import type { Clock } from '@/lib/clock';
import { ENV } from '@/lib/env-names';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';
import { kmsCredentialCipher } from '@/lib/provider-connections/kms-credential-cipher';
import { localCredentialCipher } from '@/lib/provider-connections/local-credential-cipher';

const KMS_TIMEOUT_MS = 10_000;

export const LOCAL_KEY_MISSING = `${ENV.PROVIDER_CREDENTIALS_LOCAL_KEY} is not set`;

export type CipherSettings = {
  kmsKeyName: string | undefined;
  localKey: string | undefined;
  fetch: typeof fetch;
  clock: Clock;
};

export const selectCredentialCipher = ({ kmsKeyName, localKey, fetch, clock }: CipherSettings): CredentialCipher => {
  if (kmsKeyName !== undefined) {
    const now = () => clock.now().getTime();
    const accessToken = metadataAccessToken({ fetch, now, timeoutMs: KMS_TIMEOUT_MS });
    return kmsCredentialCipher(gcpKmsClient({ keyName: kmsKeyName, fetch, accessToken, timeoutMs: KMS_TIMEOUT_MS }));
  }
  if (localKey === undefined) throw new Error(LOCAL_KEY_MISSING);
  return localCredentialCipher(localKey);
};
