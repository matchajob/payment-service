import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Charge } from '@/lib/charges/schema';
import type { PaymentMethod } from '@/lib/payments-method/schema';
import type { VerifyChargeRequest } from '@/lib/payments/provider';

export const verifyRequestFor = (
  charge: Pick<Charge, 'subscriptionId' | 'periodEnd' | 'attempt' | 'providerChargeRef' | 'chargeSerial'>,
  paymentMethodToken: PaymentMethod['providerToken'],
): VerifyChargeRequest => ({
  dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  providerChargeRef: charge.providerChargeRef,
  paymentMethodToken,
  chargeSerial: charge.chargeSerial,
});
