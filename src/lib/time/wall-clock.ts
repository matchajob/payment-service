import { INTL_DATE_PART, type IntlDatePart } from '@/lib/time/intl-date-part';

export type WallClock = {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const LOCALE = 'en-US';
const MONTH_OFFSET = 1;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  formatters.set(timeZone, formatter);
  return formatter;
};

export const wallClockIn = (instant: Date, timeZone: string): WallClock => {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const field = (type: IntlDatePart): number => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: field(INTL_DATE_PART.YEAR),
    monthIndex: field(INTL_DATE_PART.MONTH) - MONTH_OFFSET,
    day: field(INTL_DATE_PART.DAY),
    hour: field(INTL_DATE_PART.HOUR),
    minute: field(INTL_DATE_PART.MINUTE),
    second: field(INTL_DATE_PART.SECOND),
    millisecond: instant.getUTCMilliseconds(),
  };
};
