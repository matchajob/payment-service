import { describe, expect, it } from 'vitest';
import { systemClock } from '@/lib/clock';
import { LOCAL_KEY_MISSING, selectCredentialCipher } from '@/lib/provider-connections/select-credential-cipher';
import { fakeGcpKms } from '@tests/utils/fake-gcp-kms';
import { CONNECTION_ID } from '@tests/utils/connection-ids';
import { TEST_KMS_KEY_NAME } from '@tests/utils/kms-test-settings';
import { GROW_CREDENTIALS } from '@tests/utils/provider-credentials-fixtures';

const KEY_BYTES = 32;
const KEY_ENCODING = 'base64';
const LOCAL_KEY = Buffer.alloc(KEY_BYTES, 7).toString(KEY_ENCODING);

const settings = (kmsKeyName: string | undefined, localKey: string | undefined) => {
  const kms = fakeGcpKms(TEST_KMS_KEY_NAME);
  return { kms, settings: { kmsKeyName, localKey, fetch: kms.fetch, clock: systemClock } };
};

describe('selectCredentialCipher', () => {
  it('uses the local key when no KMS key is configured', async () => {
    const { kms, settings: local } = settings(undefined, LOCAL_KEY);
    const cipher = selectCredentialCipher(local);
    expect(await cipher.open(await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID), CONNECTION_ID)).toBe(GROW_CREDENTIALS);
    expect(kms.kmsPaths).toEqual([]);
  });

  it('seals through KMS where a KMS key is configured, never the local key even when one is set', async () => {
    const { kms, settings: deployed } = settings(TEST_KMS_KEY_NAME, LOCAL_KEY);
    const cipher = selectCredentialCipher(deployed);
    expect(await cipher.open(await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID), CONNECTION_ID)).toBe(GROW_CREDENTIALS);
    expect(kms.kmsPaths).toHaveLength(2);
  });

  it('builds without a local key where a KMS key is configured, so a deployed server boots', () => {
    expect(() => selectCredentialCipher(settings(TEST_KMS_KEY_NAME, undefined).settings)).not.toThrow();
  });

  it('refuses to build with neither key', () => {
    expect(() => selectCredentialCipher(settings(undefined, undefined).settings)).toThrow(LOCAL_KEY_MISSING);
  });
});
