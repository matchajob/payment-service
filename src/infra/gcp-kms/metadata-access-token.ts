import { z } from 'zod';

const METADATA_TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const METADATA_FLAVOR_HEADER = 'Metadata-Flavor';
const METADATA_FLAVOR = 'Google';
const HTTP_OK = 200;
const MS_PER_SECOND = 1000;
const REFRESH_MARGIN_MS = 60_000;

export const METADATA_TOKEN_FAILED = 'the metadata server answered with HTTP status';

const zTokenReply = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() });

export type MetadataAccessTokenConfig = { fetch: typeof fetch; now: () => number; timeoutMs: number };
type CachedToken = { value: string; refreshAt: number };

export const metadataAccessToken = ({ fetch, now, timeoutMs }: MetadataAccessTokenConfig) => {
  const cache: { token?: CachedToken } = {};
  return async (): Promise<string> => {
    if (cache.token !== undefined && now() < cache.token.refreshAt) return cache.token.value;
    const response = await fetch(METADATA_TOKEN_URL, {
      headers: { [METADATA_FLAVOR_HEADER]: METADATA_FLAVOR },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== HTTP_OK) throw new Error(`${METADATA_TOKEN_FAILED} ${response.status}`);
    const reply = zTokenReply.parse(await response.json());
    cache.token = {
      value: reply.access_token,
      refreshAt: now() + reply.expires_in * MS_PER_SECOND - REFRESH_MARGIN_MS,
    };
    return reply.access_token;
  };
};
