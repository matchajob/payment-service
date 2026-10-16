import { describe, expect, it } from 'vitest';
import { DELIVERY_TIMEOUT_MS, LEASE_MS } from '@/lib/outbox/delivery-timing';

describe('delivery timing (ADR 0009)', () => {
  it('leases a claim for longer than a POST may take, so a slow healthy POST is never claimed twice', () => {
    expect(LEASE_MS).toBeGreaterThan(DELIVERY_TIMEOUT_MS);
  });
});
