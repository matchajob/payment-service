import type { ChargeCycle, DueCharge } from '@/lib/charge-cycle/charge-cycle';
import { CYCLE_RESULT, type CycleResult } from '@/lib/charge-cycle/cycle-result';
import { CYCLE_START } from '@/lib/charge-cycle/cycle-start';
import { settleCycleCharge } from '@/lib/charge-cycle/settle-cycle-charge';
import { startCycleCharge } from '@/lib/charge-cycle/start-cycle-charge';
import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Database } from '@/lib/db';
import { findProviderConnection } from '@/lib/provider-connections/find-provider-connection';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';

const MISSING_CONNECTION = 'charged subscription references a missing provider connection';

export type ChargeOneDeps = { db: Database; providerFor: ProviderFor };

export const chargeOne = async (
  cycle: ChargeCycle,
  { db, providerFor }: ChargeOneDeps,
  { subscriptionId, providerConnectionId }: DueCharge,
  now: Date,
): Promise<CycleResult> => {
  const connection = await findProviderConnection(db, providerConnectionId);
  if (connection === undefined) throw new Error(MISSING_CONNECTION);
  const provider = await providerFor(connection);

  const start = await startCycleCharge(cycle, db, subscriptionId, now);
  if (start.kind === CYCLE_START.SKIPPED) return CYCLE_RESULT.SKIPPED;
  if (start.kind === CYCLE_START.CANCELED) return CYCLE_RESULT.CANCELED;

  const { charge, paymentMethodToken, parties } = start;
  const result = await provider.charge({
    paymentMethodToken,
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  });
  await settleCycleCharge(cycle, db, { charge, result, parties, now });
  return CYCLE_RESULT.CHARGED;
};
