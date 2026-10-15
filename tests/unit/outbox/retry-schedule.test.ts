import { describe, expect, it } from 'vitest';
import { MAX_DELIVERY_ATTEMPTS, retryDelayAfter } from '@/lib/outbox/retry-schedule';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const SVIX_DELAYS = [5 * SECOND, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 5 * HOUR, 10 * HOUR, 10 * HOUR];

describe('retry schedule (Spec 5 rules 2 and 6, ADR 0009)', () => {
  it('dead-letters after 8 attempts', () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(8);
  });

  it('waits the Svix delays after each of the first 7 failed attempts', () => {
    const delays = SVIX_DELAYS.map((_, index) => retryDelayAfter(index + 1));
    expect(delays).toEqual(SVIX_DELAYS);
  });

  it('schedules no retry after the 8th failed attempt, so the 9th never happens', () => {
    expect(retryDelayAfter(MAX_DELIVERY_ATTEMPTS)).toBeUndefined();
  });

  it('gives a tenant about 27.5 hours to recover before an event goes dead', () => {
    const total = SVIX_DELAYS.reduce((sum, delay) => sum + delay, 0);
    expect(total).toBe(27 * HOUR + 35 * MINUTE + 5 * SECOND);
  });
});
