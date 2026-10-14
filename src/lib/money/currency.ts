export const CURRENCY = { ILS: 'ILS', USD: 'USD' } as const;

export type Currency = (typeof CURRENCY)[keyof typeof CURRENCY];