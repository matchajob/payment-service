import { describe, expect, it } from 'vitest';
import { strMaxSizeTheme } from '@matcha/infra/validations/z-string';
import { toLastError, UNKNOWN_DELIVERY_ERROR } from '@/lib/outbox/last-error';

const COLUMN_MAX = strMaxSizeTheme.errorMessage;

describe('toLastError (rule 6: the last error is retained)', () => {
  it('keeps a short error as it is', () => {
    expect(toLastError('HTTP 503')).toBe('HTTP 503');
  });

  it('cuts an error longer than the column, so recording the attempt can never fail on its own check', () => {
    const long = 'x'.repeat(COLUMN_MAX + 1);
    expect(toLastError(long)).toHaveLength(COLUMN_MAX);
  });

  it('names an empty error instead of storing an empty string the column rejects', () => {
    expect(toLastError('')).toBe(UNKNOWN_DELIVERY_ERROR);
  });
});
