export const INTL_DATE_PART = {
  YEAR: 'year',
  MONTH: 'month',
  DAY: 'day',
  HOUR: 'hour',
  MINUTE: 'minute',
  SECOND: 'second',
} as const;

export type IntlDatePart = (typeof INTL_DATE_PART)[keyof typeof INTL_DATE_PART];
