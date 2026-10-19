import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Charge } from '@/lib/charges/schema';
import type { ChargeRequest } from '@/lib/payments/provider';

export const chargeRequestFor = (
  charge: Pick<Charge, 'subscriptionId' | 'periodEnd' | 'attempt' | 'amountMinor' | 'currency' | 'chargeSerial'>,
  paymentMethodToken: string,
): ChargeRequest => ({
  paymentMethodToken,
  amountMinor: charge.amountMinor,
  currency: charge.currency,
  dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  chargeSerial: charge.chargeSerial,
});
