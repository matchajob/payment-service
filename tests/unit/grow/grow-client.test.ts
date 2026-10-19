import { describe, expect, it } from 'vitest';
import { growClient } from '@/infra/grow/grow-client';
import { fakeGrowFetch } from '@tests/utils/fake-grow-fetch';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';
import {
  BLOCK_PAGE,
  RECORDED_CHECKOUT_URL,
  RECORDED_CREATE_PROCESS_OK,
  RECORDED_MISSING_FIELD,
  RECORDED_MISSING_FIELD_ID,
  RECORDED_MISSING_FIELD_MESSAGE,
  RECORDED_MISSING_FIELD_STRING_CODES,
  RECORDED_UNKNOWN_METHOD,
} from '@tests/utils/grow-recorded-replies';

const BASE_URL = 'https://sandbox.grow.test/api/light/server/1.0/';
const METHOD = GROW_WIRE_METHOD.CREATE_PAYMENT_PROCESS;
const PLATFORM_API_KEY = 'platform-api-key';
const TIMEOUT_MS = 20;
const HTTP_SERVICE_UNAVAILABLE = 503;
const MULTIPART = /^multipart\/form-data/;
const TRAILING_SLASH = /\/$/;
const FIELDS = { pageCode: 'page-1', 'pageField[fullName]': 'ישראל ישראלי' };

const clientOver = (apiKey: string | undefined = undefined) => {
  const wire = fakeGrowFetch();
  return { wire, client: growClient({ baseUrl: BASE_URL, apiKey, fetch: wire.fetch, timeoutMs: TIMEOUT_MS }) };
};

describe('growClient: the request (grow skill, Transport)', () => {
  it('posts the fields as multipart form data to the method under the base URL', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await client.call(METHOD, FIELDS);
    expect(wire.requests).toEqual([
      { url: `${BASE_URL}${METHOD}`, method: METHOD, contentType: expect.stringMatching(MULTIPART), fields: FIELDS },
    ]);
  });

  it('keeps the last path segment of a base URL configured without its trailing slash', async () => {
    const wire = fakeGrowFetch();
    const client = growClient({
      baseUrl: BASE_URL.replace(TRAILING_SLASH, ''),
      apiKey: undefined,
      fetch: wire.fetch,
      timeoutMs: TIMEOUT_MS,
    });
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await client.call(METHOD, FIELDS);
    expect(wire.requests[0]?.url).toBe(`${BASE_URL}${METHOD}`);
  });

  it("adds the platform's apiKey to every request when one is configured", async () => {
    const { wire, client } = clientOver(PLATFORM_API_KEY);
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await client.call(METHOD, FIELDS);
    expect(wire.requests[0]?.fields).toEqual({ ...FIELDS, apiKey: PLATFORM_API_KEY });
  });
});

describe('growClient: reading the envelope (grow skill, Transport)', () => {
  it('returns the data of a status 1 reply', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    expect(await client.call(METHOD, FIELDS)).toEqual({
      ok: true,
      data: expect.objectContaining({ url: RECORDED_CHECKOUT_URL }),
    });
  });

  it('returns the error id and message of a status 0 reply', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_MISSING_FIELD);
    expect(await client.call(METHOD, FIELDS)).toEqual({
      ok: false,
      errorId: RECORDED_MISSING_FIELD_ID,
      message: RECORDED_MISSING_FIELD_MESSAGE,
    });
  });

  it('reads status and error id the same whether Grow sends them as numbers or strings', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_MISSING_FIELD_STRING_CODES);
    expect(await client.call(METHOD, FIELDS)).toEqual({
      ok: false,
      errorId: RECORDED_MISSING_FIELD_ID,
      message: RECORDED_MISSING_FIELD_MESSAGE,
    });
  });
});

describe('growClient: replies it cannot vouch for throw, so a charge stays pending (grow skill, Failure classes)', () => {
  it('throws on a body that is not the envelope, such as a WAF block page', async () => {
    const { wire, client } = clientOver();
    wire.reply(BLOCK_PAGE);
    await expect(client.call(METHOD, FIELDS)).rejects.toThrow();
  });

  it('throws on a failure whose err is a bare string, which carries no id', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_UNKNOWN_METHOD);
    await expect(client.call(METHOD, FIELDS)).rejects.toThrow();
  });

  it('throws on a non-200 HTTP status even when the body is an envelope', async () => {
    const { wire, client } = clientOver();
    wire.reply(RECORDED_CREATE_PROCESS_OK, HTTP_SERVICE_UNAVAILABLE);
    await expect(client.call(METHOD, FIELDS)).rejects.toThrow();
  });

  it('throws when the network call fails', async () => {
    const { wire, client } = clientOver();
    wire.rejectWith(new TypeError('fetch failed'));
    await expect(client.call(METHOD, FIELDS)).rejects.toThrow();
  });

  it('gives up after the configured timeout instead of waiting for Grow', async () => {
    const { wire, client } = clientOver();
    wire.hang();
    await expect(client.call(METHOD, FIELDS)).rejects.toThrow();
  });
});
