import type { Charge } from '@/lib/charges/schema';
import { CHARGE_KIND, type ChargeKind } from '@/lib/reconcile/charge-kind';

const RENEWAL_ATTEMPT = 0;

export const chargeKindOf = ({
  attempt,
  attemptedAt,
  periodEnd,
}: Pick<Charge, 'attempt' | 'attemptedAt' | 'periodEnd'>): ChargeKind => {
  if (attempt > RENEWAL_ATTEMPT) return CHARGE_KIND.RETRY;
  return attemptedAt < periodEnd ? CHARGE_KIND.FIRST : CHARGE_KIND.RENEWAL;
};
