const HTTP_OK = 200;
const GROW_CONTENT_TYPE = 'text/html; charset=UTF-8';

export type GrowRequest = { url: string; method: string; contentType: string | null; fields: Record<string, string> };

type ScriptedReply =
  { kind: 'body'; body: string; status: number } | { kind: 'reject'; error: Error } | { kind: 'hang' };

export type FakeGrowFetch = {
  fetch: typeof fetch;
  requests: GrowRequest[];
  reply: (body: string, status?: number) => void;
  rejectWith: (error: Error) => void;
  hang: () => void;
};

export const FAKE_GROW_NO_REPLY = 'fakeGrowFetch: no scripted reply';

const formFields = async (request: Request): Promise<Record<string, string>> => {
  const form = await request.formData();
  return Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)]));
};

const untilAborted = (signal: AbortSignal | null | undefined): Promise<never> =>
  new Promise((_, reject) => {
    signal?.addEventListener('abort', () => reject(signal.reason));
  });

export const fakeGrowFetch = (): FakeGrowFetch => {
  const requests: GrowRequest[] = [];
  const replies: ScriptedReply[] = [];

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    requests.push({
      url: request.url,
      method: url.pathname.split('/').filter(Boolean).at(-1) ?? '',
      contentType: request.headers.get('content-type'),
      fields: await formFields(request),
    });
    const scripted = replies.shift();
    if (scripted === undefined) throw new Error(FAKE_GROW_NO_REPLY);
    if (scripted.kind === 'reject') throw scripted.error;
    if (scripted.kind === 'hang') return untilAborted(init?.signal);
    return new Response(scripted.body, { status: scripted.status, headers: { 'content-type': GROW_CONTENT_TYPE } });
  };

  return {
    fetch: fakeFetch,
    requests,
    reply: (body, status = HTTP_OK) => {
      replies.push({ kind: 'body', body, status });
    },
    rejectWith: (error) => {
      replies.push({ kind: 'reject', error });
    },
    hang: () => {
      replies.push({ kind: 'hang' });
    },
  };
};
