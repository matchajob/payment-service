export type FetchInit = { method: string; headers: Record<string, string>; body?: string };

export type FetchLike = (url: string, init: FetchInit) => Promise<Response>;

export type ClientOptions = { baseUrl: string; apiKey: string; fetch?: FetchLike };

export type CallOptions = { idempotencyKey?: string };
