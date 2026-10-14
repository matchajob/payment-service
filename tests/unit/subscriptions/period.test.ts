import { describe, expect, it } from 'vitest';
import { advancePeriod, startPeriod } from '@/lib/subscriptions/period';

describe('advancePeriod', () => {
    it('advances Jan 31 to Feb 28 and keeps the anchor so Mar 31 follows', () => {
        const jan31 = new Date(Date.UTC(2025, 0, 31));
        const anchorDay = 31;

        const feb28 = advancePeriod(jan31, anchorDay, 'month');
        const mar31 = advancePeriod(feb28, anchorDay, 'month');

        expect(feb28).toEqual(new Date(Date.UTC(2025, 1, 28)));
        expect(mar31).toEqual(new Date(Date.UTC(2025, 2, 31)));
    });

    it('advances a mid-month anchor to the same day next month', () => {
        const mar14 = new Date(Date.UTC(2025, 2, 14));
        expect(advancePeriod(mar14, 14, 'month')).toEqual(new Date(Date.UTC(2025, 3, 14)));
    });

    it('advances December into January of the next year', () => {
        const dec15 = new Date(Date.UTC(2025, 11, 15));
        expect(advancePeriod(dec15, 15, 'month')).toEqual(new Date(Date.UTC(2026, 0, 15)));
    });

    it('advances Feb 29 yearly to Feb 28 and back to Feb 29 in the next leap year', () => {
        const feb29 = new Date(Date.UTC(2024, 1, 29));
        const anchorDay = 29;
        const y2025 = advancePeriod(feb29, anchorDay, 'year');
        const y2026 = advancePeriod(y2025, anchorDay, 'year');
        const y2027 = advancePeriod(y2026, anchorDay, 'year');
        const y2028 = advancePeriod(y2027, anchorDay, 'year');
        expect(y2025).toEqual(new Date(Date.UTC(2025, 1, 28)));
        expect(y2028).toEqual(new Date(Date.UTC(2028, 1, 29)));
    });

    it('does not mutate the previous end', () => {
        const jan31 = new Date(Date.UTC(2025, 0, 31));
        advancePeriod(jan31, 31, 'month');
        expect(jan31).toEqual(new Date(Date.UTC(2025, 0, 31)));
    });

    it('preserves the time of day across the advance', () => {
        const jan31at10 = new Date(Date.UTC(2025, 0, 31, 10, 30, 15, 500));
        expect(advancePeriod(jan31at10, 31, 'month')).toEqual(new Date(Date.UTC(2025, 1, 28, 10, 30, 15, 500)));
    });
});

describe('startPeriod', () => {
  it('returns the activation day as the anchor and one interval ahead as the end', () => {
    const activatedAt = new Date(Date.UTC(2025, 0, 31, 9, 0, 0, 0));
    expect(startPeriod(activatedAt, 'month')).toEqual({
      periodEnd: new Date(Date.UTC(2025, 1, 28, 9, 0, 0, 0)),
      anchorDay: 31,
    });
  });
});