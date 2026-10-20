const HTTP_OK = 200;
const JSON_CONTENT_TYPE = 'application/json';
const AUTHORIZATION = 'authorization';
const IDEMPOTENCY_KEY = 'idempotency-key';
const CONTENT_TYPE = 'content-type';
const STRIPE_VERSION = 'stripe-version';

export type StripeRequest = {
  url: string;
  path: string;
  verb: string;
  authorization: string | null;
  idempotencyKey: string | null;
  contentType: string | null;
  stripeVersion: string | null;
  query: URLSearchParams;
  fields: Record<string, string>;
};

type ScriptedReply =
  { kind: 'body'; body: string; status: number } | { kind: 'reject'; error: Error } | { kind: 'hang' };

export type FakeStripeFetch = {
  fetch: typeof fetch;
  requests: StripeRequest[];
  reply: (body: object | string, status?: number) => void;
  rejectWith: (error: Error) => void;
  hang: () => void;
};

export const FAKE_STRIPE_NO_REPLY = 'fakeStripeFetch: no scripted reply';

const untilAborted = (signal: AbortSignal | null | undefined): Promise<never> =>
  new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

export const fakeStripeFetch = (): FakeStripeFetch => {
  const requests: StripeRequest[] = [];
  const replies: ScriptedReply[] = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    requests.push({
      url: request.url,
      path: url.pathname,
      verb: request.method,
      authorization: request.headers.get(AUTHORIZATION),
      idempotencyKey: request.headers.get(IDEMPOTENCY_KEY),
      contentType: request.headers.get(CONTENT_TYPE),
      stripeVersion: request.headers.get(STRIPE_VERSION),
      query: url.searchParams,
      fields: Object.fromEntries(new URLSearchParams(await request.text())),
    });
    const scripted = replies.shift();
    if (scripted === undefined) throw new Error(FAKE_STRIPE_NO_REPLY);
    if (scripted.kind === 'reject') throw scripted.error;
    if (scripted.kind === 'hang') return untilAborted(init?.signal);
    return new Response(scripted.body, { status: scripted.status, headers: { [CONTENT_TYPE]: JSON_CONTENT_TYPE } });
  };

  return {
    fetch: fakeFetch,
    requests,
    reply: (body, status = HTTP_OK) => {
      replies.push({ kind: 'body', body: typeof body === 'string' ? body : JSON.stringify(body), status });
    },
    rejectWith: (error) => {
      replies.push({ kind: 'reject', error });
    },
    hang: () => {
      replies.push({ kind: 'hang' });
    },
  };
};
