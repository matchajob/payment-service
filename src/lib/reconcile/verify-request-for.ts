import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Charge } from '@/lib/charges/schema';
import type { VerifyChargeRequest } from '@/lib/payments/provider';

export const verifyRequestFor = (
  charge: Pick<Charge, 'subscriptionId' | 'periodEnd' | 'attempt' | 'providerChargeRef'>,
): VerifyChargeRequest => ({
  dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  providerChargeRef: charge.providerChargeRef,
});
