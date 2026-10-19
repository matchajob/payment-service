import { CURRENCY, type Currency } from '@/lib/money/currency';

const ILS_ONLY = 'grow charges in ILS only';

export const assertIls = (currency: Currency): void => {
  if (currency !== CURRENCY.ILS) throw new Error(ILS_ONLY);
};
