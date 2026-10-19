import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { dunningDay, FINAL_RETRY_DAY, seedPastDue } from '@tests/utils/dunning-rows';
import {
  FIRST_CHARGE,
  FIRST_RETRY,
  IMMEDIATE_RETRY,
  RENEWAL,
  RETRIES_BEFORE_CARD_UPDATE,
  type ChargeShape,
} from '@tests/utils/pending-charge-shapes';
import { seedRenewing, seedRenewings, type Renewing } from '@tests/utils/renewal-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

type NewCharge = typeof chargesTable.$inferInsert;
type ChargeOverrides = Partial<
  Pick<NewCharge, 'attemptedAt' | 'providerChargeRef' | 'status' | 'failureReason' | 'reconcileFlag' | 'flaggedAt'>
>;

export type PendingCharge = Renewing & { charge: Charge };

const addCharge = async (
  db: Database,
  renewing: Renewing,
  shape: ChargeShape,
  overrides: ChargeOverrides,
): Promise<PendingCharge> => {
  const { ctx, subscription, paymentMethodId } = renewing;
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
  return { ...renewing, charge };
};

export const seedPendingRenewal = async (
  db: Database,
  overrides: ChargeOverrides = {},
  tenant?: TenantFixture,
): Promise<PendingCharge> => addCharge(db, await seedRenewing(db, {}, tenant), RENEWAL, overrides);

export const seedPendingRenewals = async (db: Database, count: number): Promise<PendingCharge[]> => {
  const { renewings } = await seedRenewings(db, count);
  return Promise.all(renewings.map((renewing) => addCharge(db, renewing, RENEWAL, {})));
};

export const seedPendingFirstCharge = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedRenewing(db), FIRST_CHARGE, overrides);

export const seedPendingRetry = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedPastDue(db), FIRST_RETRY, overrides);

export const seedPendingImmediateRetry = async (
  db: Database,
  overrides: ChargeOverrides = {},
): Promise<PendingCharge> =>
  addCharge(
    db,
    await seedPastDue(db, { dunningAttempt: RETRIES_BEFORE_CARD_UPDATE, nextRetryAt: dunningDay(FINAL_RETRY_DAY) }),
    IMMEDIATE_RETRY,
    overrides,
  );

export const seedLostRenewal = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedPastDue(db), RENEWAL, {
    status: CHARGE_STATUS.FAILED,
    failureReason: NOT_FOUND_REASON,
    ...overrides,
  });
