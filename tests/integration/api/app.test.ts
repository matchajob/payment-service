import { describe, expect, it } from 'vitest';
import { testApp } from '@tests/utils/test-app';
import { problemSchema } from '@/contract/problem';
import { testDb } from '@tests/utils/db';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';
import { everyConnection } from '@tests/utils/fake-provider-factory';

const db = testDb();

describe('createApp', () => {
  it('answers /health', async () => {
    const res = await testApp(db).request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('answers an unknown route with problem+json', async () => {
    const res = await testApp(db).request('/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('application/problem+json');
    expect(problemSchema.parse(await res.json()).status).toBe(404);
  });

  it('builds without asking any provider for capabilities; connection creation checks them now (ADR 0010 decision 3)', () => {
    const provider = fakePaymentProvider();
    const unsafe = { ...provider, capabilities: { ...provider.capabilities, saveCardWithoutCharge: false } };
    expect(() => testApp(db, { providerFor: everyConnection(unsafe) })).not.toThrow();
  });
});
