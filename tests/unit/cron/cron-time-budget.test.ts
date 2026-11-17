import { describe, expect, it } from 'vitest';
import { cronTimeBudget } from '@/lib/cron/cron-time-budget';
import { CRON_TIME_BUDGET_MS } from '@/lib/cron/cron-time-budget-ms';
import { fakeClock } from '@tests/utils/fake-clock';

const START = new Date('2026-01-15T10:00:00.000Z');
const ONE_MS = 1;

describe('cronTimeBudget (code-review-1 M11)', () => {
  it('has time left until the budget has elapsed since the run started', () => {
    const clock = fakeClock(START);
    const timeUp = cronTimeBudget(clock);
    clock.advance(CRON_TIME_BUDGET_MS - ONE_MS);
    expect(timeUp()).toBe(false);
  });

  it('is up once the whole budget has elapsed', () => {
    const clock = fakeClock(START);
    const timeUp = cronTimeBudget(clock);
    clock.advance(CRON_TIME_BUDGET_MS);
    expect(timeUp()).toBe(true);
  });
});
