import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { CredentialCipher } from '@/lib/provider-connections/credential-cipher';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ENCODING = 'base64';
const PART_ENCODING = 'base64url';
const TEXT_ENCODING = 'utf8';
const FORMAT = 'local-v1';
const SEPARATOR = '.';
const PART_COUNT = 4;

export const WRONG_KEY_LENGTH = `the local credentials key must be ${KEY_BYTES} bytes, base64-encoded`;
export const NOT_LOCALLY_SEALED = 'credentials were not sealed by the local cipher';

export const localCredentialCipher = (base64Key: string): CredentialCipher => {
  const key = Buffer.from(base64Key, KEY_ENCODING);
  if (key.length !== KEY_BYTES) throw new Error(WRONG_KEY_LENGTH);
  return {
    seal: async (plaintext) => {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      const ciphertext = Buffer.concat([cipher.update(plaintext, TEXT_ENCODING), cipher.final()]);
      const parts = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString(PART_ENCODING));
      return [FORMAT, ...parts].join(SEPARATOR);
    },
    open: async (sealed) => {
      const parts = sealed.split(SEPARATOR);
      const [format, iv, tag, ciphertext] = parts;
      if (
        parts.length !== PART_COUNT ||
        format !== FORMAT ||
        iv === undefined ||
        tag === undefined ||
        ciphertext === undefined
      )
        throw new Error(NOT_LOCALLY_SEALED);
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, PART_ENCODING), { authTagLength: TAG_BYTES });
      decipher.setAuthTag(Buffer.from(tag, PART_ENCODING));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, PART_ENCODING)), decipher.final()]).toString(
        TEXT_ENCODING,
      );
    },
  };
};
