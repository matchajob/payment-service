import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/reconcile/charge-kind';
import { chargeKindOf } from '@/lib/reconcile/charge-kind-of';

const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');
const ACTIVATED_AT = new Date('2026-01-15T10:00:00.000Z');
const LATE_CRON = new Date('2026-02-17T10:00:00.000Z');

describe('chargeKindOf (ADR 0017 decision 4)', () => {
  it('calls attempt 0 made before its period end charge #1, which pays for period 1 in advance', () => {
    expect(chargeKindOf({ attempt: 0, attemptedAt: ACTIVATED_AT, periodEnd: PERIOD_END })).toBe(CHARGE_KIND.FIRST);
  });

  it('calls attempt 0 made at its period end a renewal', () => {
    expect(chargeKindOf({ attempt: 0, attemptedAt: PERIOD_END, periodEnd: PERIOD_END })).toBe(CHARGE_KIND.RENEWAL);
  });

  it('calls attempt 0 made after its period end a renewal, as when the cron ran late', () => {
    expect(chargeKindOf({ attempt: 0, attemptedAt: LATE_CRON, periodEnd: PERIOD_END })).toBe(CHARGE_KIND.RENEWAL);
  });

  it.each([1, 2, 3])('calls attempt %i a dunning retry', (attempt) => {
    expect(chargeKindOf({ attempt, attemptedAt: LATE_CRON, periodEnd: PERIOD_END })).toBe(CHARGE_KIND.RETRY);
  });
});
