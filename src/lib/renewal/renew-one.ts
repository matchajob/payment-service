import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';
import type { Database } from '@/lib/db';
import { findProviderConnection } from '@/lib/provider-connections/find-provider-connection';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';
import type { DueRenewal } from '@/lib/renewal/find-due-renewals';
import { RENEWAL_RESULT, type RenewalResult } from '@/lib/renewal/renewal-result';
import { RENEWAL_START } from '@/lib/renewal/renewal-start';
import { settleRenewal } from '@/lib/renewal/settle-renewal';
import { startRenewal } from '@/lib/renewal/start-renewal';

const MISSING_CONNECTION = 'renewing subscription references a missing provider connection';

export type RenewOneDeps = { db: Database; providerFor: ProviderFor };

export const renewOne = async (
  { db, providerFor }: RenewOneDeps,
  { subscriptionId, providerConnectionId }: DueRenewal,
  now: Date,
): Promise<RenewalResult> => {
  const connection = await findProviderConnection(db, providerConnectionId);
  if (connection === undefined) throw new Error(MISSING_CONNECTION);
  const provider = await providerFor(connection);

  const start = await startRenewal(db, subscriptionId, now);
  if (start.kind === RENEWAL_START.SKIPPED) return RENEWAL_RESULT.SKIPPED;
  if (start.kind === RENEWAL_START.CANCELED) return RENEWAL_RESULT.CANCELED;

  const { charge, paymentMethodToken, parties } = start;
  const result = await provider.charge({
    paymentMethodToken,
    amountMinor: charge.amountMinor,
    currency: charge.currency,
    dedupKey: chargeDedupKey(charge.subscriptionId, charge.periodEnd, charge.attempt),
  });
  await settleRenewal(db, { charge, result, parties, now });
  return RENEWAL_RESULT.RENEWED;
};
