import { describe, expect, it } from 'vitest';
import { METADATA_TOKEN_FAILED, metadataAccessToken } from '@/infra/gcp-kms/metadata-access-token';
import { fakeGcpKms } from '@tests/utils/fake-gcp-kms';
import { FAKE_TOKEN_LIFETIME_SECONDS } from '@tests/utils/fake-metadata-server';
import { TEST_KMS_KEY_NAME, TEST_KMS_TIMEOUT_MS } from '@tests/utils/kms-test-settings';

const MS_PER_SECOND = 1000;
const REFRESH_MARGIN_SECONDS = 60;

const tokenSource = () => {
  const kms = fakeGcpKms(TEST_KMS_KEY_NAME);
  const time = { now: 0 };
  const accessToken = metadataAccessToken({ fetch: kms.fetch, now: () => time.now, timeoutMs: TEST_KMS_TIMEOUT_MS });
  return { kms, time, accessToken };
};

describe('metadataAccessToken', () => {
  it('gets a token from the metadata server, which only answers with the Metadata-Flavor header', async () => {
    const { kms, accessToken } = tokenSource();
    expect(await accessToken()).not.toBe('');
    expect(kms.tokensIssued()).toBe(1);
  });

  it('reuses the token while it has more than a minute left', async () => {
    const { kms, time, accessToken } = tokenSource();
    const first = await accessToken();
    time.now = (FAKE_TOKEN_LIFETIME_SECONDS - REFRESH_MARGIN_SECONDS - 1) * MS_PER_SECOND;
    expect(await accessToken()).toBe(first);
    expect(kms.tokensIssued()).toBe(1);
  });

  it('fetches a fresh token once the cached one is within a minute of expiry', async () => {
    const { kms, time, accessToken } = tokenSource();
    const first = await accessToken();
    time.now = (FAKE_TOKEN_LIFETIME_SECONDS - REFRESH_MARGIN_SECONDS) * MS_PER_SECOND;
    expect(await accessToken()).not.toBe(first);
    expect(kms.tokensIssued()).toBe(2);
  });

  it('surfaces a metadata server failure', async () => {
    const { kms, accessToken } = tokenSource();
    kms.goDown();
    await expect(accessToken()).rejects.toThrow(METADATA_TOKEN_FAILED);
  });
});
