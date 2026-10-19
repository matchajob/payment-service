import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { insertCycleCharge, type ChargeOverrides } from '@tests/utils/cycle-charge-insert';
import { dunningDay, FINAL_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue, seedPastDueSubscription } from '@tests/utils/dunning-rows';
import {
  FIRST_CHARGE,
  FIRST_RETRY,
  IMMEDIATE_RETRY,
  RENEWAL,
  RETRIES_BEFORE_CARD_UPDATE,
  type ChargeShape,
} from '@tests/utils/pending-charge-shapes';
import { seedAwaitingFirstCharge, seedRenewing, seedRenewings, type Renewing } from '@tests/utils/renewal-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

export type PendingCharge = Renewing & { charge: Charge };

const addCharge = async (
  db: Database,
  renewing: Renewing,
  shape: ChargeShape,
  overrides: ChargeOverrides,
): Promise<PendingCharge> => ({ ...renewing, charge: await insertCycleCharge(db, renewing, shape, overrides) });

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
  addCharge(db, await seedAwaitingFirstCharge(db), FIRST_CHARGE, overrides);

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
  addCharge(db, await seedPastDueSubscription(db), RENEWAL, {
    status: CHARGE_STATUS.FAILED,
    failureReason: NOT_FOUND_REASON,
    ...overrides,
  });
