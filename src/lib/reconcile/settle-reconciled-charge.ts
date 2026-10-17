import { findCycleParties } from '@/lib/charge-cycle/find-cycle-parties';
import { settleCycleCharge } from '@/lib/charge-cycle/settle-cycle-charge';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { dunningCycle } from '@/lib/dunning/dunning-cycle';
import type { ChargeResult } from '@/lib/payments/provider';
import { CHARGE_KIND } from '@/lib/reconcile/charge-kind';
import { chargeKindOf } from '@/lib/reconcile/charge-kind-of';
import { renewalCycle } from '@/lib/renewal/renewal-cycle';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import { settleFirstCharge } from '@/lib/subscriptions/settle-first-charge';

const MISSING = 'reconciled charge references a missing subscription';

export const settleReconciledCharge = async (
  db: Database,
  charge: Charge,
  result: ChargeResult,
  now: Date,
): Promise<boolean> => {
  const subscription = await findSubscription(db, charge.tenantId, charge.subscriptionId);
  if (subscription === undefined) throw new Error(MISSING);
  const parties = await findCycleParties(db, subscription);
  const kind = chargeKindOf(charge);
  if (kind === CHARGE_KIND.FIRST)
    return settleFirstCharge(db, { charge, result, tenant: parties.tenant, customer: parties.customer, now });
  return settleCycleCharge(kind === CHARGE_KIND.RENEWAL ? renewalCycle : dunningCycle, db, {
    charge,
    result,
    parties,
    now,
  });
};
