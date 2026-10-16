import { describe, expect, it } from 'vitest';
import { fakeTenantEndpoint, REDIRECT_TARGET_PATH } from '@tests/utils/fake-tenant-endpoint';

const BODY = '{"hello":"world"}';
const HEADER = 'Payments-Test';
const CREATED = 201;
const SERVER_ERROR = 500;
const FOUND = 302;
const OK = 200;

const post = (url: string) =>
  fetch(url, { method: 'POST', body: BODY, headers: { [HEADER]: 'yes' }, redirect: 'manual' });

describe('fakeTenantEndpoint', () => {
  it('records the path, the exact body and the headers of each delivery', async () => {
    const endpoint = await fakeTenantEndpoint();
    await post(endpoint.url);
    expect(endpoint.deliveries).toHaveLength(1);
    expect(endpoint.deliveries[0]?.body).toBe(BODY);
    expect(endpoint.deliveries[0]?.header(HEADER)).toBe('yes');
    expect(endpoint.url.endsWith(endpoint.deliveries[0]?.path ?? '-')).toBe(true);
  });

  it('answers with the scripted statuses in order, then 200', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(CREATED, SERVER_ERROR);
    const first = await post(endpoint.url);
    const second = await post(endpoint.url);
    const third = await post(endpoint.url);
    expect([first.status, second.status, third.status]).toEqual([CREATED, SERVER_ERROR, OK]);
  });

  it('points a scripted redirect somewhere else on the same server', async () => {
    const endpoint = await fakeTenantEndpoint();
    endpoint.reply(FOUND);
    const response = await post(endpoint.url);
    expect(response.status).toBe(FOUND);
    expect(response.headers.get('location')).toBe(REDIRECT_TARGET_PATH);
  });
});
