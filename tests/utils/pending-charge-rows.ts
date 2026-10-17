import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { dunningDay, FIRST_RETRY_DAY, seedPastDue } from '@tests/utils/dunning-rows';
import { PERIOD_END, seedRenewing, seedRenewings, type Renewing } from '@tests/utils/renewal-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

type NewCharge = typeof chargesTable.$inferInsert;
type ChargeOverrides = Partial<
  Pick<NewCharge, 'attemptedAt' | 'providerChargeRef' | 'status' | 'failureReason' | 'reconcileFlag' | 'flaggedAt'>
>;

export type PendingCharge = Renewing & { charge: Charge };

export const FIRST_CHARGE_AT = new Date('2026-01-15T10:00:00.000Z');
export const RENEWAL_ATTEMPTED_AT = PERIOD_END;
export const RETRY_ATTEMPTED_AT = dunningDay(FIRST_RETRY_DAY);

const FIRST_CHARGE_ATTEMPT = 0;
const RENEWAL_ATTEMPT = 0;
const FIRST_RETRY_ATTEMPT = 1;

const addCharge = async (
  db: Database,
  renewing: Renewing,
  attempt: number,
  attemptedAt: Date,
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
      periodEnd: PERIOD_END,
      attempt,
      amountMinor: ctx.plan.amountMinor,
      currency: ctx.plan.currency,
      status: CHARGE_STATUS.PENDING,
      providerChargeRef: null,
      failureReason: null,
      attemptedAt,
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
): Promise<PendingCharge> =>
  addCharge(db, await seedRenewing(db, {}, tenant), RENEWAL_ATTEMPT, RENEWAL_ATTEMPTED_AT, overrides);

export const seedPendingRenewals = async (db: Database, count: number): Promise<PendingCharge[]> => {
  const { renewings } = await seedRenewings(db, count);
  return Promise.all(renewings.map((renewing) => addCharge(db, renewing, RENEWAL_ATTEMPT, RENEWAL_ATTEMPTED_AT, {})));
};

export const seedPendingFirstCharge = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedRenewing(db), FIRST_CHARGE_ATTEMPT, FIRST_CHARGE_AT, overrides);

export const seedPendingRetry = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedPastDue(db), FIRST_RETRY_ATTEMPT, RETRY_ATTEMPTED_AT, overrides);

export const seedLostRenewal = async (db: Database, overrides: ChargeOverrides = {}): Promise<PendingCharge> =>
  addCharge(db, await seedPastDue(db), RENEWAL_ATTEMPT, RENEWAL_ATTEMPTED_AT, {
    status: CHARGE_STATUS.FAILED,
    failureReason: NOT_FOUND_REASON,
    ...overrides,
  });
