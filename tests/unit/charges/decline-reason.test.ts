import { describe, expect, it } from 'vitest';
import { declineReason, UNSPECIFIED_DECLINE } from '@/lib/charges/decline-reason';
import { StrMaxSizes } from '@matcha/infra/validations/z-string';

describe('declineReason (ADR 0008: the outcome write must not be rejected)', () => {
  it('keeps the provider reason as given', () => {
    expect(declineReason('insufficient funds')).toBe('insufficient funds');
  });

  it.each(['', '   '])('names a blank reason %j instead of failing the non-empty column', (reason) => {
    expect(declineReason(reason)).toBe(UNSPECIFIED_DECLINE);
  });

  it('cuts a reason longer than the column, so the insert never aborts', () => {
    expect(declineReason('x'.repeat(StrMaxSizes.xxl + 10))).toHaveLength(StrMaxSizes.xxl);
  });
});
