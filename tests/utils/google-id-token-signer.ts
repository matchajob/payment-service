import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { validGoogleClaims } from '@tests/utils/google-id-token-fixtures';

const SIGNING_ALGORITHM = 'RS256';
const KEY_ID = 'test-google-key';

export type GoogleSigner = { keys: JWTVerifyGetKey; sign: (overrides?: JWTPayload) => Promise<string> };

export const googleSigner = async (): Promise<GoogleSigner> => {
  const { publicKey, privateKey } = await generateKeyPair(SIGNING_ALGORITHM);
  const publishedKey = { ...(await exportJWK(publicKey)), kid: KEY_ID, alg: SIGNING_ALGORITHM };
  return {
    keys: createLocalJWKSet({ keys: [publishedKey] }),
    sign: (overrides = {}) =>
      new SignJWT({ ...validGoogleClaims(), ...overrides })
        .setProtectedHeader({ alg: SIGNING_ALGORITHM, kid: KEY_ID })
        .sign(privateKey),
  };
};
