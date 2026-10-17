import type { z } from 'zod';
import type { ClientOptions, FetchLike } from '@sdk/client-options';
import { defaultSleep } from '@sdk/default-sleep';
import { HTTP_METHOD, type HttpMethod } from '@sdk/http-method';
import { PaymentServiceError } from '@sdk/payment-service-error';
import { readProblem } from '@sdk/read-problem';
import { DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS } from '@sdk/retry-policy';
import { sendWithRetry } from '@sdk/send-with-retry';

const JSON_CONTENT_TYPE = 'application/json';
const AUTHORIZATION_HEADER = 'authorization';
const CONTENT_TYPE_HEADER = 'content-type';
const BEARER_PREFIX = 'Bearer ';
const IDEMPOTENCY_HEADER = 'idempotency-key';
const TRAILING_SLASHES = /\/+$/;

export type Call<T> = {
  method: HttpMethod;
  path: string;
  response: z.ZodType<T>;
  body?: unknown;
  idempotencyKey?: string;
};

export type Requester = <T>(call: Call<T>) => Promise<T>;

const globalFetch: FetchLike = (url, init) => fetch(url, init);

export const createRequester = ({
  baseUrl,
  apiKey,
  fetch: send = globalFetch,
  retries = DEFAULT_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  sleep = defaultSleep,
}: ClientOptions): Requester => {
  const root = baseUrl.replace(TRAILING_SLASHES, '');

  return async (call) => {
    const body = call.body === undefined ? undefined : JSON.stringify(call.body);
    const response = await sendWithRetry(
      send,
      `${root}${call.path}`,
      {
        method: call.method,
        headers: {
          [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${apiKey}`,
          ...(body === undefined ? {} : { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE }),
          ...(call.method === HTTP_METHOD.GET
            ? {}
            : { [IDEMPOTENCY_HEADER]: call.idempotencyKey ?? crypto.randomUUID() }),
        },
        body,
      },
      { retries, timeoutMs, sleep },
    );
    if (!response.ok) throw new PaymentServiceError(await readProblem(response));
    return call.response.parse(await response.json());
  };
};
