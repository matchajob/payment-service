import { describe, expect, it } from 'vitest';
import {
  localCredentialCipher,
  NOT_LOCALLY_SEALED,
  WRONG_KEY_LENGTH,
} from '@/lib/provider-connections/local-credential-cipher';
import { GROW_CREDENTIALS, GROW_SECRET_API_KEY } from '@tests/utils/provider-credentials-fixtures';
import { SEALED_TEST_CREDENTIALS } from '@tests/utils/connection-rows';

const KEY_BYTES = 32;
const SHORT_KEY_BYTES = 16;
const KEY_ENCODING = 'base64';
const SEPARATOR = '.';
const TAG_PART = 2;
const TRUNCATED_TAG_LENGTH = 4;

const keyOf = (fill: number, bytes = KEY_BYTES) => Buffer.alloc(bytes, fill).toString(KEY_ENCODING);
const KEY = keyOf(7);
const OTHER_KEY = keyOf(9);

const withPart = (sealed: string, index: number, replace: (part: string) => string) =>
  sealed
    .split(SEPARATOR)
    .map((part, i) => (i === index ? replace(part) : part))
    .join(SEPARATOR);

const flipFirstChar = (part: string) => `${part.startsWith('A') ? 'B' : 'A'}${part.slice(1)}`;

describe('localCredentialCipher (ADR 0010 amendment 4, option A)', () => {
  it('opens what it sealed', async () => {
    const cipher = localCredentialCipher(KEY);
    expect(await cipher.open(await cipher.seal(GROW_CREDENTIALS))).toBe(GROW_CREDENTIALS);
  });

  it('never stores the plaintext, and seals the same input differently each time', async () => {
    const cipher = localCredentialCipher(KEY);
    const first = await cipher.seal(GROW_CREDENTIALS);
    const second = await cipher.seal(GROW_CREDENTIALS);
    expect(first).not.toContain(GROW_SECRET_API_KEY);
    expect(first).not.toBe(second);
  });

  it('refuses to open with a different key', async () => {
    const sealed = await localCredentialCipher(KEY).seal(GROW_CREDENTIALS);
    await expect(localCredentialCipher(OTHER_KEY).open(sealed)).rejects.toThrow();
  });

  it('refuses a tampered ciphertext', async () => {
    const cipher = localCredentialCipher(KEY);
    const sealed = await cipher.seal(GROW_CREDENTIALS);
    const lastPart = sealed.split(SEPARATOR).length - 1;
    await expect(cipher.open(withPart(sealed, lastPart, flipFirstChar))).rejects.toThrow();
  });

  it('refuses a truncated authentication tag, which GCM would otherwise accept', async () => {
    const cipher = localCredentialCipher(KEY);
    const sealed = await cipher.seal(GROW_CREDENTIALS);
    const truncated = withPart(sealed, TAG_PART, (tag) => tag.slice(0, TRUNCATED_TAG_LENGTH));
    await expect(cipher.open(truncated)).rejects.toThrow();
  });

  it.each([
    ['a value from another cipher', SEALED_TEST_CREDENTIALS],
    ['an empty string', ''],
    ['too many parts', 'local-v1.a.b.c.d'],
  ])('refuses %s', async (_, sealed) => {
    await expect(localCredentialCipher(KEY).open(sealed)).rejects.toThrow(NOT_LOCALLY_SEALED);
  });

  it('refuses a key that is not 32 bytes', () => {
    expect(() => localCredentialCipher(keyOf(7, SHORT_KEY_BYTES))).toThrow(WRONG_KEY_LENGTH);
  });
});
