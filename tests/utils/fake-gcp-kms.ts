import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { jsonResponse } from '@tests/utils/json-response';
import { fakeMetadataServer, METADATA_HOST } from '@tests/utils/fake-metadata-server';
import { UPSTREAM_HTTP_STATUS } from '@tests/utils/upstream-http-status';

const AUTHORIZATION_HEADER = 'authorization';
const BEARER_SCHEME = 'Bearer';
const ENCRYPT_SUFFIX = ':encrypt';
const DECRYPT_SUFFIX = ':decrypt';
const API_PREFIX = '/v1/';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION_BYTES = 1;
const BASE64 = 'base64';

const zEncryptBody = z.object({ plaintext: z.string(), additionalAuthenticatedData: z.string() });
const zDecryptBody = z.object({ ciphertext: z.string(), additionalAuthenticatedData: z.string() });

export type FakeGcpKms = {
  fetch: typeof fetch;
  rotate: () => void;
  goDown: () => void;
  tokensIssued: () => number;
  kmsPaths: string[];
};

const refused = () =>
  jsonResponse({ error: { code: UPSTREAM_HTTP_STATUS.BAD_REQUEST } }, UPSTREAM_HTTP_STATUS.BAD_REQUEST);

export const fakeGcpKms = (keyName: string): FakeGcpKms => {
  const versions: Buffer[] = [randomBytes(KEY_BYTES)];
  const metadata = fakeMetadataServer();
  const kmsPaths: string[] = [];
  const state = { down: false };

  const encrypt = (body: z.infer<typeof zEncryptBody>) => {
    const version = versions.length - 1;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, versions[version]!, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(body.additionalAuthenticatedData, BASE64));
    const sealed = Buffer.concat([cipher.update(Buffer.from(body.plaintext, BASE64)), cipher.final()]);
    const ciphertext = Buffer.concat([Buffer.from([version]), iv, cipher.getAuthTag(), sealed]).toString(BASE64);
    return jsonResponse({ name: `${keyName}/cryptoKeyVersions/${version + 1}`, ciphertext });
  };

  const decrypt = (body: z.infer<typeof zDecryptBody>) => {
    const raw = Buffer.from(body.ciphertext, BASE64);
    const key = versions[raw[0] ?? versions.length];
    if (key === undefined) return refused();
    const ivEnd = VERSION_BYTES + IV_BYTES;
    const tagEnd = ivEnd + TAG_BYTES;
    try {
      const decipher = createDecipheriv(ALGORITHM, key, raw.subarray(VERSION_BYTES, ivEnd), {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(body.additionalAuthenticatedData, BASE64));
      decipher.setAuthTag(raw.subarray(ivEnd, tagEnd));
      const plaintext = Buffer.concat([decipher.update(raw.subarray(tagEnd)), decipher.final()]);
      return jsonResponse({ plaintext: plaintext.toString(BASE64) });
    } catch {
      return refused();
    }
  };

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (state.down) return jsonResponse({}, UPSTREAM_HTTP_STATUS.SERVICE_UNAVAILABLE);
    if (url.host === METADATA_HOST) return metadata.handle(request);
    kmsPaths.push(url.pathname);
    if (request.headers.get(AUTHORIZATION_HEADER) !== `${BEARER_SCHEME} ${metadata.latestToken()}`) {
      return jsonResponse({}, UPSTREAM_HTTP_STATUS.UNAUTHORIZED);
    }
    const body: unknown = await request.json();
    if (url.pathname === `${API_PREFIX}${keyName}${ENCRYPT_SUFFIX}`) return encrypt(zEncryptBody.parse(body));
    if (url.pathname === `${API_PREFIX}${keyName}${DECRYPT_SUFFIX}`) return decrypt(zDecryptBody.parse(body));
    return jsonResponse({}, UPSTREAM_HTTP_STATUS.NOT_FOUND);
  };

  return {
    fetch: fakeFetch,
    rotate: () => versions.push(randomBytes(KEY_BYTES)),
    goDown: () => {
      state.down = true;
    },
    tokensIssued: metadata.tokensIssued,
    kmsPaths,
  };
};
