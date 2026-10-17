import { describe, expect, it } from 'vitest';
import { restartDunning } from '@/lib/dunning/restart-dunning';
import { DAY_MS } from '@/lib/time/day-ms';

const FAILED_AT = new Date('2026-02-20T10:00:00.000Z');
const FAILED_ATTEMPT = 3;
const DEFAULT_SCHEDULE = [1, 3, 7];
const TENANT_SCHEDULE = [2, 5];
const TWO_DAYS = 2;

describe('restartDunning (S1 r14, ADR 0018 decision 2)', () => {
  it('starts a new clock at the failure and bases the schedule on the failed attempt', () => {
    expect(restartDunning(FAILED_AT, FAILED_ATTEMPT, DEFAULT_SCHEDULE)).toEqual({
      dunningStartedAt: FAILED_AT,
      dunningAttempt: FAILED_ATTEMPT,
      dunningAttemptBase: FAILED_ATTEMPT,
      nextRetryAt: new Date(FAILED_AT.getTime() + DAY_MS),
    });
  });

  it("schedules the first retry by the tenant's own first offset", () => {
    expect(restartDunning(FAILED_AT, FAILED_ATTEMPT, TENANT_SCHEDULE).nextRetryAt).toEqual(
      new Date(FAILED_AT.getTime() + TWO_DAYS * DAY_MS),
    );
  });
});
