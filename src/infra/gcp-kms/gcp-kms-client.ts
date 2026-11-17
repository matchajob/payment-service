import { z } from 'zod';

const KMS_API = 'https://cloudkms.googleapis.com/v1/';
const ENCRYPT = ':encrypt';
const DECRYPT = ':decrypt';
const POST = 'POST';
const HTTP_OK = 200;
const AUTHORIZATION_HEADER = 'authorization';
const BEARER_SCHEME = 'Bearer';
const CONTENT_TYPE_HEADER = 'content-type';
const JSON_CONTENT_TYPE = 'application/json';
const BASE64 = 'base64';
const UTF8 = 'utf8';

export const KMS_CALL_FAILED = 'cloud kms answered with HTTP status';

const zEncryptReply = z.object({ ciphertext: z.string().min(1) });
const zDecryptReply = z.object({ plaintext: z.string() });

export type GcpKmsClientConfig = {
  keyName: string;
  fetch: typeof fetch;
  accessToken: () => Promise<string>;
  timeoutMs: number;
};
export type GcpKmsClient = {
  encrypt: (plaintext: string, associatedData: string) => Promise<string>;
  decrypt: (ciphertext: string, associatedData: string) => Promise<string>;
};

const base64Of = (text: string) => Buffer.from(text, UTF8).toString(BASE64);

export const gcpKmsClient = ({ keyName, fetch, accessToken, timeoutMs }: GcpKmsClientConfig): GcpKmsClient => {
  const call = async (method: string, body: Record<string, string>): Promise<unknown> => {
    const response = await fetch(`${KMS_API}${keyName}${method}`, {
      method: POST,
      headers: {
        [AUTHORIZATION_HEADER]: `${BEARER_SCHEME} ${await accessToken()}`,
        [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== HTTP_OK) throw new Error(`${KMS_CALL_FAILED} ${response.status}`);
    return response.json();
  };
  return {
    encrypt: async (plaintext, associatedData) => {
      const body = { plaintext: base64Of(plaintext), additionalAuthenticatedData: base64Of(associatedData) };
      return zEncryptReply.parse(await call(ENCRYPT, body)).ciphertext;
    },
    decrypt: async (ciphertext, associatedData) => {
      const body = { ciphertext, additionalAuthenticatedData: base64Of(associatedData) };
      return Buffer.from(zDecryptReply.parse(await call(DECRYPT, body)).plaintext, BASE64).toString(UTF8);
    },
  };
};
