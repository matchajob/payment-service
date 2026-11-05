import { describe, expect, it } from 'vitest';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';
import { advancePeriod, startPeriod } from '@/lib/subscriptions/period';

const JERUSALEM = 'Asia/Jerusalem';
const UTC = 'UTC';
const { MONTH } = BILLING_INTERVAL;

describe("period math in the tenant's time zone (code-review-1 N12)", () => {
  it('anchors on the local day: 01:30 on April 1 in Israel is still March 31 in UTC', () => {
    const activatedAt = new Date('2026-03-31T22:30:00.000Z');
    expect(startPeriod(activatedAt, MONTH, JERUSALEM)).toEqual({
      anchorDay: 1,
      periodEnd: new Date('2026-04-30T22:30:00.000Z'),
    });
    expect(startPeriod(activatedAt, MONTH, UTC).anchorDay).toBe(31);
  });

  it('keeps the local billing hour when Israel leaves daylight time (10:00 stays 10:00)', () => {
    const october15at10Local = new Date('2026-10-15T07:00:00.000Z');
    expect(advancePeriod(october15at10Local, 15, MONTH, JERUSALEM)).toEqual(new Date('2026-11-15T08:00:00.000Z'));
  });

  it('keeps the local billing hour when Israel enters daylight time', () => {
    const march15at10Local = new Date('2026-03-15T08:00:00.000Z');
    expect(advancePeriod(march15at10Local, 15, MONTH, JERUSALEM)).toEqual(new Date('2026-04-15T07:00:00.000Z'));
  });

  it('clamps a 31st anchor to the last local day of February', () => {
    const january31at10Local = new Date('2026-01-31T08:00:00.000Z');
    expect(advancePeriod(january31at10Local, 31, MONTH, JERUSALEM)).toEqual(new Date('2026-02-28T08:00:00.000Z'));
  });

  it('moves a just-after-midnight local end to the same local day next month, not the UTC day', () => {
    const february1at0030Local = new Date('2026-01-31T22:30:00.000Z');
    expect(advancePeriod(february1at0030Local, 1, MONTH, JERUSALEM)).toEqual(new Date('2026-02-28T22:30:00.000Z'));
  });
});
