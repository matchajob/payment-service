import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { nextPeriodEnd } from '@/lib/subscriptions/next-period-end';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { insertCycleCharge } from '@tests/utils/cycle-charge-insert';
import { DECLINE_REASON } from '@tests/utils/declined-charge-fixtures';
import { DUNNING_STARTED_AT, dunningDay, FIRST_RETRY_DAY } from '@tests/utils/dunning-days';
import { RENEWAL, retryShape } from '@tests/utils/pending-charge-shapes';
import { seedRenewing, seedRenewings, type Renewing } from '@tests/utils/renewal-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

type Overrides = Parameters<typeof seedRenewing>[1];

const FIRST_RETRY_ATTEMPT = 1;
const DECLINED = { status: CHARGE_STATUS.FAILED, failureReason: DECLINE_REASON } as const;

const PAST_DUE = {
  status: SUBSCRIPTION_STATUS.PAST_DUE,
  dunningStartedAt: DUNNING_STARTED_AT,
  nextRetryAt: dunningDay(FIRST_RETRY_DAY),
  dunningAttempt: 0,
} as const;

export const seedPastDueSubscription = (
  db: Database,
  overrides: Overrides = {},
  tenant?: TenantFixture,
): Promise<Renewing> => seedRenewing(db, { ...PAST_DUE, ...overrides }, tenant);

const failedRetries = (pastDue: Renewing, periodEnd: Date) =>
  Array.from({ length: pastDue.subscription.dunningAttempt }, (_, index) => ({
    ...retryShape(index + FIRST_RETRY_ATTEMPT),
    periodEnd,
  }));

const withFailedAttempts = async (db: Database, pastDue: Renewing): Promise<Renewing> => {
  const periodEnd = nextPeriodEnd(pastDue.subscription, pastDue.ctx.plan);
  const attemptedAt = pastDue.subscription.currentPeriodEnd ?? RENEWAL.attemptedAt;
  const renewal = await insertCycleCharge(db, pastDue, { ...RENEWAL, periodEnd, attemptedAt }, DECLINED);
  const retries = await Promise.all(
    failedRetries(pastDue, periodEnd).map((shape) => insertCycleCharge(db, pastDue, shape, DECLINED)),
  );
  return { ...pastDue, history: [...pastDue.history, renewal, ...retries] };
};

export const seedPastDue = async (db: Database, overrides: Overrides = {}, tenant?: TenantFixture): Promise<Renewing> =>
  withFailedAttempts(db, await seedPastDueSubscription(db, overrides, tenant));

export const seedPastDues = async (db: Database, count: number, overrides: Overrides = {}) => {
  const { ctx, renewings } = await seedRenewings(db, count, { ...PAST_DUE, ...overrides });
  return { ctx, pastDues: await Promise.all(renewings.map((pastDue) => withFailedAttempts(db, pastDue))) };
};
