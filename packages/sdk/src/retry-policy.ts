const HTTP_BAD_GATEWAY = 502;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_GATEWAY_TIMEOUT = 504;
const BASE_DELAY_MS = 200;
const BACKOFF_FACTOR = 2;
const HALF = 0.5;

const RETRYABLE_STATUS: ReadonlySet<number> = new Set([
  HTTP_BAD_GATEWAY,
  HTTP_SERVICE_UNAVAILABLE,
  HTTP_GATEWAY_TIMEOUT,
]);

export const DEFAULT_RETRIES = 2;
export const DEFAULT_TIMEOUT_MS = 30_000;

export const isRetryableStatus = (status: number): boolean => RETRYABLE_STATUS.has(status);

export const backoffMs = (attempt: number): number => {
  const ceiling = BASE_DELAY_MS * BACKOFF_FACTOR ** attempt;
  return ceiling * HALF + Math.random() * ceiling * HALF;
};
