import type { StripeReply } from '@/infra/stripe/stripe-reply';

const VERB = { GET: 'GET', POST: 'POST' } as const;
const HEADER = {
  AUTHORIZATION: 'Authorization',
  CONTENT_TYPE: 'Content-Type',
  IDEMPOTENCY_KEY: 'Idempotency-Key',
  STRIPE_VERSION: 'Stripe-Version',
} as const;
const STRIPE_API_VERSION = '2026-09-30.endive';
const FORM_ENCODED = 'application/x-www-form-urlencoded';
const BEARER = 'Bearer';
const HTTP_SERVER_ERROR = 500;
const SERVER_ERROR = 'stripe answered with HTTP status';
const UNREADABLE = 'stripe reply is not JSON';

export type StripeFields = Record<string, string>;
export type StripeQuery = ReadonlyArray<readonly [string, string]>;
export type StripeClientConfig = { baseUrl: string; secretKey: string; fetch: typeof fetch; timeoutMs: number };
export type StripeClient = {
  get: (path: string, query: StripeQuery) => Promise<StripeReply>;
  post: (path: string, fields: StripeFields, idempotencyKey?: string) => Promise<StripeReply>;
};

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(UNREADABLE);
  }
};

const errorOf = (body: unknown): unknown =>
  typeof body === 'object' && body !== null && 'error' in body ? body.error : body;

const replyOf = async (response: Response): Promise<StripeReply> => {
  if (response.status >= HTTP_SERVER_ERROR) throw new Error(`${SERVER_ERROR} ${response.status}`);
  const body = parseJson(await response.text());
  return response.ok ? { ok: true, data: body } : { ok: false, status: response.status, error: errorOf(body) };
};

export const stripeClient = ({ baseUrl, secretKey, fetch, timeoutMs }: StripeClientConfig): StripeClient => {
  const baseHeaders = {
    [HEADER.AUTHORIZATION]: `${BEARER} ${secretKey}`,
    [HEADER.STRIPE_VERSION]: STRIPE_API_VERSION,
  };
  return {
    get: async (path, query) => {
      const url = new URL(path, baseUrl);
      query.forEach(([key, value]) => url.searchParams.append(key, value));
      return replyOf(
        await fetch(url, { method: VERB.GET, headers: baseHeaders, signal: AbortSignal.timeout(timeoutMs) }),
      );
    },
    post: async (path, fields, idempotencyKey) =>
      replyOf(
        await fetch(new URL(path, baseUrl), {
          method: VERB.POST,
          headers: {
            ...baseHeaders,
            [HEADER.CONTENT_TYPE]: FORM_ENCODED,
            ...(idempotencyKey === undefined ? {} : { [HEADER.IDEMPOTENCY_KEY]: idempotencyKey }),
          },
          body: new URLSearchParams(fields),
          signal: AbortSignal.timeout(timeoutMs),
        }),
      ),
  };
};
