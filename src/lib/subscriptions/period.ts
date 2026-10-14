

export type BillingInterval = 'month' | 'year';

const MONTHS_PER_YEAR = 12;
const LAST_DAY_OF_PREVIOUS_MONTH = 0;
const MONTHS_IN_INTERVAL: Record<BillingInterval, number> = { month: 1, year: MONTHS_PER_YEAR };

const daysInMonth = (year: number, monthIndex:number): number =>
    new Date(Date.UTC(year, monthIndex + 1, LAST_DAY_OF_PREVIOUS_MONTH)).getUTCDate();

export const advancePeriod = (
    previousEnd: Date,
    anchorDay: number,
    interval: BillingInterval
): Date => {
    const totalMonths = previousEnd.getUTCMonth() + MONTHS_IN_INTERVAL[interval];
    const year = previousEnd.getFullYear() + Math.floor(totalMonths / MONTHS_PER_YEAR);
    const monthIndex = totalMonths % MONTHS_PER_YEAR;
    const day = Math.min(anchorDay, daysInMonth(year, monthIndex));
    return new Date(Date.UTC(
        year,
        monthIndex,
        day,
        previousEnd.getUTCHours(),
        previousEnd.getUTCMinutes(),
        previousEnd.getUTCSeconds(),
        previousEnd.getUTCMilliseconds(),
    ));
};

export const startPeriod = (
    activatedAt: Date,
    interval: BillingInterval
): { periodEnd: Date; anchorDay: number } => {
    const anchorDay = activatedAt.getUTCDate();
    return { periodEnd: advancePeriod(activatedAt, anchorDay, interval), anchorDay };
};
