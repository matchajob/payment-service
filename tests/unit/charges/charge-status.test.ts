import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { VerifiedCharge } from '@/lib/payments/provider';

const sorted = (values: readonly string[]) => [...values].sort();

describe('CHARGE_STATUS', () => {
  it('is exactly the set of outcomes verifyCharge can report, so reconcile can store any of them', () => {
    const outcomes: Record<VerifiedCharge['outcome'], true> = { succeeded: true, failed: true, pending: true };
    expect(sorted(Object.values(CHARGE_STATUS))).toEqual(sorted(Object.keys(outcomes)));
  });
});
