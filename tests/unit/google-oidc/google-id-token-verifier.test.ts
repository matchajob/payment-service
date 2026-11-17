import { SignJWT, type JWTVerifyGetKey } from 'jose';
import { describe, expect, it } from 'vitest';
import { googleIdTokenVerifier } from '@/infra/google-oidc/google-id-token-verifier';
import {
  expiredClaims,
  TEST_CRON_AUDIENCE,
  TEST_CRON_INVOKER_EMAIL,
  validGoogleClaims,
} from '@tests/utils/google-id-token-fixtures';
import { googleSigner } from '@tests/utils/google-id-token-signer';

const SHARED_SECRET_ALGORITHM = 'HS256';
const KEYS_UNREACHABLE = 'Google certs unreachable';

const verifierOver = (keys: JWTVerifyGetKey) =>
  googleIdTokenVerifier({ audience: TEST_CRON_AUDIENCE, email: TEST_CRON_INVOKER_EMAIL, keys });

const google = await googleSigner();

describe('googleIdTokenVerifier (ADR 0012)', () => {
  it('accepts a token Google signed for our audience and our cron invoker', async () => {
    expect(await verifierOver(google.keys)(await google.sign())).toBe(true);
  });

  it('rejects a token minted for another audience', async () => {
    const token = await google.sign({ aud: 'some-other-service' });
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects a token for another service account', async () => {
    const token = await google.sign({ email: 'someone-else@test-project.iam.gserviceaccount.com' });
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects a token whose email Google has not verified', async () => {
    const token = await google.sign({ email_verified: false });
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const token = await google.sign(expiredClaims());
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects a token from an issuer other than Google', async () => {
    const token = await google.sign({ iss: 'https://attacker.example' });
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects a token signed by a key Google does not publish', async () => {
    const impostor = await googleSigner();
    expect(await verifierOver(google.keys)(await impostor.sign())).toBe(false);
  });

  it('rejects a shared-secret token, because the algorithm is pinned to RS256', async () => {
    const token = await new SignJWT(validGoogleClaims())
      .setProtectedHeader({ alg: SHARED_SECRET_ALGORITHM })
      .sign(new TextEncoder().encode('a-guessable-shared-secret-of-enough-length'));
    expect(await verifierOver(google.keys)(token)).toBe(false);
  });

  it('rejects a string that is not a token', async () => {
    expect(await verifierOver(google.keys)('not-a-token')).toBe(false);
  });

  it('surfaces a failure to fetch Google keys instead of reporting it as a rejection', async () => {
    const unreachable: JWTVerifyGetKey = async () => {
      throw new Error(KEYS_UNREACHABLE);
    };
    await expect(verifierOver(unreachable)(await google.sign())).rejects.toThrow(KEYS_UNREACHABLE);
  });
});
