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

export const stubResponse =
  (status: number, body: string, contentType: string): FetchLike =>
  async () =>
    new Response(body, { status, headers: { 'content-type': contentType } });
