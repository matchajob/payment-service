import { parseGrowReply } from '@/infra/grow/parse-grow-reply';
import type { GrowReply } from '@/infra/grow/grow-reply';

const HTTP_OK = 200;
const POST = 'POST';
const API_KEY_FIELD = 'apiKey';
const NOT_OK = 'grow answered with HTTP status';
const PATH_SEPARATOR = '/';

const directoryOf = (baseUrl: string): string =>
  baseUrl.endsWith(PATH_SEPARATOR) ? baseUrl : `${baseUrl}${PATH_SEPARATOR}`;
export type GrowFields = Record<string, string>;
export type GrowClientConfig = { baseUrl: string; apiKey: string | undefined; fetch: typeof fetch; timeoutMs: number };
export type GrowClient = { call: (method: string, fields: GrowFields) => Promise<GrowReply> };

const formOf = (fields: GrowFields, apiKey: string | undefined): FormData => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  if (apiKey !== undefined) form.append(API_KEY_FIELD, apiKey);
  return form;
};

export const growClient = ({ baseUrl, apiKey, fetch, timeoutMs }: GrowClientConfig): GrowClient => ({
  call: async (method, fields) => {
    const response = await fetch(new URL(method, directoryOf(baseUrl)), {
      method: POST,
      body: formOf(fields, apiKey),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== HTTP_OK) throw new Error(`${NOT_OK} ${response.status}`);
    return parseGrowReply(await response.text());
  },
});
