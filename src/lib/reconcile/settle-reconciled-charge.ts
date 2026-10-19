import type { CycleDecide } from '@/lib/charge-cycle/charge-cycle';
import { findCycleParties } from '@/lib/charge-cycle/find-cycle-parties';
import { settleCycleCharge } from '@/lib/charge-cycle/settle-cycle-charge';
import { CHARGE_KIND, type ChargeKind } from '@/lib/charges/charge-kind';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { dunningCycle } from '@/lib/dunning/dunning-cycle';
import { immediateRetryDecide } from '@/lib/payment-method-updates/immediate-retry-decide';
import type { ChargeResult } from '@/lib/payments/provider';
import { renewalCycle } from '@/lib/renewal/renewal-cycle';
import { findSubscription } from '@/lib/subscriptions/find-subscription';
import { settleFirstCharge } from '@/lib/subscriptions/settle-first-charge';

const MISSING = 'reconciled charge references a missing subscription';

const DECIDE_BY_KIND: Record<Exclude<ChargeKind, typeof CHARGE_KIND.FIRST>, CycleDecide> = {
  [CHARGE_KIND.RENEWAL]: renewalCycle.decide,
  [CHARGE_KIND.RETRY]: dunningCycle.decide,
  [CHARGE_KIND.IMMEDIATE_RETRY]: immediateRetryDecide,
};

export const settleReconciledCharge = async (
  db: Database,
  charge: Charge,
  result: ChargeResult,
  now: Date,
): Promise<boolean> => {
  const subscription = await findSubscription(db, charge.tenantId, charge.subscriptionId);
  if (subscription === undefined) throw new Error(MISSING);
  const parties = await findCycleParties(db, subscription);
  if (charge.kind === CHARGE_KIND.FIRST)
    return settleFirstCharge(db, { charge, result, tenant: parties.tenant, customer: parties.customer, now });
  return settleCycleCharge(DECIDE_BY_KIND[charge.kind], db, { charge, result, parties, now });
};
