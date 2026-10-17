import type { FetchInit, FetchLike, Sleep } from '@sdk/client-options';
import { backoffMs, isRetryableStatus } from '@sdk/retry-policy';

const FIRST_ATTEMPT = 0;

type Attempt = { response: Response } | { failure: unknown };

export type RetrySettings = { retries: number; timeoutMs: number; sleep: Sleep };

export const sendWithRetry = async (
  send: FetchLike,
  url: string,
  init: Omit<FetchInit, 'signal'>,
  settings: RetrySettings,
  attempt: number = FIRST_ATTEMPT,
): Promise<Response> => {
  const outcome: Attempt = await send(url, { ...init, signal: AbortSignal.timeout(settings.timeoutMs) }).then(
    (response) => ({ response }),
    (failure: unknown) => ({ failure }),
  );
  const retryable = 'failure' in outcome || isRetryableStatus(outcome.response.status);

  if (!retryable || attempt >= settings.retries) {
    if ('failure' in outcome) throw outcome.failure;
    return outcome.response;
  }

  if ('response' in outcome) await outcome.response.body?.cancel();
  await settings.sleep(backoffMs(attempt));
  return sendWithRetry(send, url, init, settings, attempt + 1);
};
