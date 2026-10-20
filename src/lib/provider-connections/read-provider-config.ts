import { readRequiredEnv } from '@/lib/env';
import { ENV } from '@/lib/env-names';
import type { ProviderConfig } from '@/lib/provider-connections/provider-config';

const GROW_TIMEOUT_MS = 10_000;
const STRIPE_TIMEOUT_MS = 30_000;
const STRIPE_DEFAULT_BASE_URL = 'https://api.stripe.com';

export const readProviderConfig = (): ProviderConfig => ({
  publicBaseUrl: readRequiredEnv(ENV.PUBLIC_BASE_URL),
  grow: {
    baseUrl: readRequiredEnv(ENV.GROW_BASE_URL),
    apiKey: process.env[ENV.GROW_API_KEY],
    timeoutMs: GROW_TIMEOUT_MS,
  },
  stripe: {
    baseUrl: process.env[ENV.STRIPE_BASE_URL] ?? STRIPE_DEFAULT_BASE_URL,
    timeoutMs: STRIPE_TIMEOUT_MS,
  },
  fetch: globalThis.fetch,
});
