import { describe, expect, it } from 'vitest';
import { requestHash } from '@/lib/idempotency/request-hash';

const REQUEST = { method: 'POST', path: '/v1/subscriptions/a/cancel', body: '{}' };

describe('requestHash (Spec 3 r3, code-review-1 M2)', () => {
  it('is stable for the same request', () => {
    expect(requestHash(REQUEST)).toBe(requestHash({ ...REQUEST }));
  });

  it('differs when only the path differs, so a key reused on another subscription is not a replay', () => {
    expect(requestHash(REQUEST)).not.toBe(requestHash({ ...REQUEST, path: '/v1/subscriptions/b/cancel' }));
  });

  it('differs when only the method differs', () => {
    expect(requestHash(REQUEST)).not.toBe(requestHash({ ...REQUEST, method: 'PATCH' }));
  });

  it('differs when only the body differs', () => {
    expect(requestHash(REQUEST)).not.toBe(requestHash({ ...REQUEST, body: '{"a":1}' }));
  });

  it('cannot be forged by moving characters across the path and body boundary', () => {
    expect(requestHash({ ...REQUEST, path: '/v1/x', body: 'y' })).not.toBe(
      requestHash({ ...REQUEST, path: '/v1/', body: 'xy' }),
    );
  });
});
