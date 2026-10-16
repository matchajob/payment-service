import { describe, expect, it } from 'vitest';
import { nextRetryAt } from '@/lib/dunning/next-retry-at';
import { TENANT_POLICY_DEFAULTS } from '@/lib/tenants/tenant-policy-defaults';
import { DAY_MS } from '@/lib/time/day-ms';

const STARTED_AT = new Date('2026-02-15T10:00:00.000Z');
const DEFAULT_SCHEDULE = TENANT_POLICY_DEFAULTS.dunningScheduleDays;
const CUSTOM_SCHEDULE = [2, 5];
const day = (days: number) => new Date(STARTED_AT.getTime() + days * DAY_MS);

describe('nextRetryAt (Spec 2 retry arithmetic)', () => {
  it.each([
    [1, day(1)],
    [2, day(3)],
    [3, day(7)],
  ])('puts retry %i of the default schedule at its offset from the failed attempt 0', (attempt, expected) => {
    expect(nextRetryAt(STARTED_AT, attempt, DEFAULT_SCHEDULE)).toEqual(expected);
  });

  it('counts every offset from attempt 0, never from the previous retry (day 7, not 1 + 3 + 7)', () => {
    expect(nextRetryAt(STARTED_AT, DEFAULT_SCHEDULE.length, DEFAULT_SCHEDULE)).toEqual(day(7));
  });

  it('returns null past the last entry, so the retry before it was the final one', () => {
    expect(nextRetryAt(STARTED_AT, DEFAULT_SCHEDULE.length + 1, DEFAULT_SCHEDULE)).toBeNull();
  });

  it("follows a tenant's own schedule", () => {
    expect(CUSTOM_SCHEDULE.map((_, index) => nextRetryAt(STARTED_AT, index + 1, CUSTOM_SCHEDULE))).toEqual([
      day(2),
      day(5),
    ]);
  });
});
