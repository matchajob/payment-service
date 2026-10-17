import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { VerifiedCharge } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';

const sorted = (values: readonly string[]) => [...values].sort();

describe('CHARGE_STATUS and VERIFY_OUTCOME', () => {
  it('verifyCharge reports exactly the verify outcomes', () => {
    const outcomes: Record<VerifiedCharge['outcome'], true> = {
      succeeded: true,
      failed: true,
      pending: true,
      not_found: true,
    };
    expect(sorted(Object.values(VERIFY_OUTCOME))).toEqual(sorted(Object.keys(outcomes)));
  });

  it('every charge status is a verify outcome, and only not_found has no row status (ADR 0017)', () => {
    expect(sorted(Object.values(VERIFY_OUTCOME))).toEqual(
      sorted([...Object.values(CHARGE_STATUS), VERIFY_OUTCOME.NOT_FOUND]),
    );
  });
});
