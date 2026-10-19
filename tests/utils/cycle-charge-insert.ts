import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { ChargeShape } from '@tests/utils/pending-charge-shapes';
import type { Renewing } from '@tests/utils/renewal-rows';

type NewCharge = typeof chargesTable.$inferInsert;
export type ChargeOverrides = Partial<
  Pick<NewCharge, 'attemptedAt' | 'providerChargeRef' | 'status' | 'failureReason' | 'reconcileFlag' | 'flaggedAt'>
>;

export const insertCycleCharge = async (
  db: Database,
  { ctx, subscription, paymentMethodId }: Renewing,
  shape: ChargeShape,
  overrides: ChargeOverrides,
): Promise<Charge> => {
  const [charge] = await db
    .insert(chargesTable)
    .values({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.subscriptionId,
      providerConnectionId: subscription.providerConnectionId,
      paymentMethodId,
      ...shape,
      amountMinor: ctx.plan.amountMinor,
      currency: ctx.plan.currency,
      status: CHARGE_STATUS.PENDING,
      providerChargeRef: null,
      failureReason: null,
      ...overrides,
    })
    .returning();
  if (charge === undefined) throw new Error('charge insert returned no row');
  return charge;
};
