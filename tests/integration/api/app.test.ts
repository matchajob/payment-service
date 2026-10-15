import { describe, expect, it } from 'vitest';
import { testApp } from '@tests/utils/test-app';
import { problemSchema } from '@/contract/problem';
import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';
import { testDb } from '@tests/utils/db';
import { fakePaymentProvider } from '@tests/utils/fake-payment-provider';

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

  it('refuses to build with a provider it cannot run safely (ADR 0007)', () => {
    const provider = fakePaymentProvider();
    const unsafe = { ...provider, capabilities: { ...provider.capabilities, saveCardWithoutCharge: false } };
    expect(() => testApp(db, { provider: unsafe })).toThrow(/saveCardWithoutCharge/);
  });

  it('builds with the unconfigured provider, so the server starts before slice 13', () => {
    expect(() => testApp(db, { provider: unconfiguredProvider })).not.toThrow();
  });
});
