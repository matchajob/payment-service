export type FetchInit = { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal };

export type FetchLike = (url: string, init: FetchInit) => Promise<Response>;

export type Sleep = (ms: number) => Promise<void>;

export type ClientOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: FetchLike;
  retries?: number;
  timeoutMs?: number;
  sleep?: Sleep;
};

export type CallOptions = { idempotencyKey?: string };
