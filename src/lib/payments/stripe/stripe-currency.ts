import { z } from 'zod';
import { CURRENCY, type Currency } from '@/lib/money/currency';

export const toStripeCurrency = (currency: Currency): string => currency.toLowerCase();

export const zStripeCurrency = z
  .string()
  .transform((currency) => currency.toUpperCase())
  .pipe(z.enum(CURRENCY));
