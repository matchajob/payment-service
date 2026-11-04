import type { Charge } from '@/lib/charges/schema';

export const matchesCharge = (charge: Charge, verified: Pick<Charge, 'amountMinor' | 'currency'>): boolean =>
  verified.amountMinor === charge.amountMinor && verified.currency === charge.currency;
