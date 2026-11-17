import { createRemoteJWKSet } from 'jose';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export const googleIdTokenKeys = () => createRemoteJWKSet(new URL(GOOGLE_CERTS_URL));
