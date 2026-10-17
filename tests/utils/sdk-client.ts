import type { FetchLike, FetchInit } from '@sdk/client-options';
import { createClient } from '@sdk/create-client';
import type { testApp } from '@tests/utils/test-app';

export const SDK_BASE_URL = 'http://payments.test';

type App = Pick<ReturnType<typeof testApp>, 'request'>;

export type RecordedCall = { url: string; init: FetchInit };

export const fetchInto =
  (app: App): FetchLike =>
  async (url, init) =>
    app.request(url, init);

export const recordingFetch = (inner: FetchLike) => {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return inner(url, init);
  };
  return { fetch, calls };
};

export const sdkFor = (app: App, apiKey: string) =>
  createClient({ baseUrl: SDK_BASE_URL, apiKey, fetch: fetchInto(app) });

export const losingFirstAnswer = (inner: FetchLike): FetchLike => {
  const attempts: number[] = [];
  return async (url, init) => {
    const response = await inner(url, init);
    attempts.push(attempts.length);
    if (attempts.length === 1) throw new TypeError('fetch failed');
    return response;
  };
};

export type ScriptedStep = Response | Error;

export const scriptedFetch = (...steps: ScriptedStep[]) => {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const step = steps[calls.length - 1];
    if (step === undefined) throw new Error('scripted fetch ran out of steps');
    if (step instanceof Error) throw step;
    return step;
  };
  return { fetch, calls };
};

export const recordingSleep = () => {
  const delays: number[] = [];
  return {
    delays,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
  };
};

export const stubResponse =
  (status: number, body: string, contentType: string): FetchLike =>
  async () =>
    new Response(body, { status, headers: { 'content-type': contentType } });
