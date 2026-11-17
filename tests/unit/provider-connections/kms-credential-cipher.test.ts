import { describe, expect, it } from 'vitest';
import { gcpKmsClient, KMS_CALL_FAILED } from '@/infra/gcp-kms/gcp-kms-client';
import { metadataAccessToken } from '@/infra/gcp-kms/metadata-access-token';
import { kmsCredentialCipher, NOT_KMS_SEALED } from '@/lib/provider-connections/kms-credential-cipher';
import { fakeGcpKms, type FakeGcpKms } from '@tests/utils/fake-gcp-kms';
import { CONNECTION_ID, OTHER_CONNECTION_ID } from '@tests/utils/connection-ids';
import { TEST_KMS_KEY_NAME, TEST_KMS_TIMEOUT_MS } from '@tests/utils/kms-test-settings';
import { GROW_CREDENTIALS, GROW_PAGE_CODE } from '@tests/utils/provider-credentials-fixtures';

const FIXED_NOW = 0;
const KEY_VERSION_MARKER = 'cryptoKeyVersions';

const cipherOver = (kms: FakeGcpKms) =>
  kmsCredentialCipher(
    gcpKmsClient({
      keyName: TEST_KMS_KEY_NAME,
      fetch: kms.fetch,
      timeoutMs: TEST_KMS_TIMEOUT_MS,
      accessToken: metadataAccessToken({ fetch: kms.fetch, now: () => FIXED_NOW, timeoutMs: TEST_KMS_TIMEOUT_MS }),
    }),
  );

describe('kmsCredentialCipher (slice 20, ADR 0010 amendment 4)', () => {
  it('opens what it sealed for the same connection', async () => {
    const cipher = cipherOver(fakeGcpKms(TEST_KMS_KEY_NAME));
    expect(await cipher.open(await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID), CONNECTION_ID)).toBe(GROW_CREDENTIALS);
  });

  it("refuses to open credentials copied onto another connection's row", async () => {
    const cipher = cipherOver(fakeGcpKms(TEST_KMS_KEY_NAME));
    const sealed = await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID);
    await expect(cipher.open(sealed, OTHER_CONNECTION_ID)).rejects.toThrow(KMS_CALL_FAILED);
  });

  it('never stores the plaintext, and seals the same input differently each time', async () => {
    const cipher = cipherOver(fakeGcpKms(TEST_KMS_KEY_NAME));
    const first = await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID);
    const second = await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID);
    expect(first).not.toContain(GROW_PAGE_CODE);
    expect(first).not.toBe(second);
  });

  it('still opens after the key rotates, because neither the sealed string nor the call pins a key version', async () => {
    const kms = fakeGcpKms(TEST_KMS_KEY_NAME);
    const cipher = cipherOver(kms);
    const sealed = await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID);
    kms.rotate();
    expect(await cipher.open(sealed, CONNECTION_ID)).toBe(GROW_CREDENTIALS);
    expect(sealed).not.toContain(KEY_VERSION_MARKER);
    expect(kms.kmsPaths.some((path) => path.includes(KEY_VERSION_MARKER))).toBe(false);
  });

  it.each([
    ['a locally sealed value', 'local-v2.a.b.c'],
    ['an empty string', ''],
  ])('refuses %s without calling KMS', async (_, sealed) => {
    const kms = fakeGcpKms(TEST_KMS_KEY_NAME);
    await expect(cipherOver(kms).open(sealed, CONNECTION_ID)).rejects.toThrow(NOT_KMS_SEALED);
    expect(kms.kmsPaths).toEqual([]);
  });

  it('surfaces a KMS outage as an error, never as credentials', async () => {
    const kms = fakeGcpKms(TEST_KMS_KEY_NAME);
    const cipher = cipherOver(kms);
    const sealed = await cipher.seal(GROW_CREDENTIALS, CONNECTION_ID);
    kms.goDown();
    await expect(cipher.open(sealed, CONNECTION_ID)).rejects.toThrow();
  });
});
