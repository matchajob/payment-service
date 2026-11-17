import type { JWTPayload } from 'jose';

export const GOOGLE_ISSUER = 'https://accounts.google.com';
export const TEST_CRON_AUDIENCE = 'payment-service-test-cron';
export const TEST_CRON_INVOKER_EMAIL = 'cron-invoker@test-project.iam.gserviceaccount.com';

const ONE_HOUR_SECONDS = 3600;
const MS_PER_SECOND = 1000;

export const nowSeconds = () => Math.floor(Date.now() / MS_PER_SECOND);

export const validGoogleClaims = (): JWTPayload => ({
  iss: GOOGLE_ISSUER,
  aud: TEST_CRON_AUDIENCE,
  email: TEST_CRON_INVOKER_EMAIL,
  email_verified: true,
  iat: nowSeconds(),
  exp: nowSeconds() + ONE_HOUR_SECONDS,
});

export const expiredClaims = (): JWTPayload => ({
  iat: nowSeconds() - 2 * ONE_HOUR_SECONDS,
  exp: nowSeconds() - ONE_HOUR_SECONDS,
});
