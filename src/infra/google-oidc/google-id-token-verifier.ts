import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { GOOGLE_ISSUERS } from '@/infra/google-oidc/google-issuers';

const SIGNING_ALGORITHM = 'RS256';

export type GoogleIdTokenVerifierSettings = { audience: string; email: string; keys: JWTVerifyGetKey };

export const googleIdTokenVerifier =
  ({ audience, email, keys }: GoogleIdTokenVerifierSettings) =>
  async (token: string): Promise<boolean> => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        issuer: GOOGLE_ISSUERS,
        audience,
        algorithms: [SIGNING_ALGORITHM],
      });
      return payload.email === email && payload.email_verified === true;
    } catch (error) {
      if (error instanceof errors.JOSEError) return false;
      throw error;
    }
  };
