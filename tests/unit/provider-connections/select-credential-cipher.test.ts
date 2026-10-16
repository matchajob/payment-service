import { describe, expect, it } from 'vitest';
import {
  KMS_CIPHER_PENDING,
  LOCAL_KEY_MISSING,
  selectCredentialCipher,
} from '@/lib/provider-connections/select-credential-cipher';
import { GROW_CREDENTIALS } from '@tests/utils/provider-credentials-fixtures';

const KEY_BYTES = 32;
const LOCAL_KEY = Buffer.alloc(KEY_BYTES, 7).toString('base64');
const KMS_KEY_NAME = 'projects/p/locations/me-west1/keyRings/payment-service/cryptoKeys/provider-credentials';

describe('selectCredentialCipher', () => {
  it('uses the local key when no KMS key is configured', async () => {
    const cipher = selectCredentialCipher({ kmsKeyName: undefined, localKey: LOCAL_KEY });
    expect(await cipher.open(await cipher.seal(GROW_CREDENTIALS))).toBe(GROW_CREDENTIALS);
  });

  it('never falls back to the local key where a KMS key is configured, even when one is set', async () => {
    const cipher = selectCredentialCipher({ kmsKeyName: KMS_KEY_NAME, localKey: LOCAL_KEY });
    await expect(cipher.seal(GROW_CREDENTIALS)).rejects.toThrow(KMS_CIPHER_PENDING);
    await expect(cipher.open(GROW_CREDENTIALS)).rejects.toThrow(KMS_CIPHER_PENDING);
  });

  it('builds without a local key where a KMS key is configured, so a deployed server still boots', () => {
    expect(() => selectCredentialCipher({ kmsKeyName: KMS_KEY_NAME, localKey: undefined })).not.toThrow();
  });

  it('refuses to build with neither key', () => {
    expect(() => selectCredentialCipher({ kmsKeyName: undefined, localKey: undefined })).toThrow(LOCAL_KEY_MISSING);
  });
});
