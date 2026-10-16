import type { Database } from '@/lib/db';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { PERIOD_END, seedRenewing, type Renewing } from '@tests/utils/renewal-rows';
import type { TenantFixture } from '@tests/utils/tenant-fixtures';

type Overrides = Parameters<typeof seedRenewing>[1];

export const DUNNING_STARTED_AT = PERIOD_END;
export const dunningDay = (days: number): Date => new Date(DUNNING_STARTED_AT.getTime() + days * DAY_MS);

export const FIRST_RETRY_DAY = 1;
export const SECOND_RETRY_DAY = 3;
export const FINAL_RETRY_DAY = 7;

const PAST_DUE = {
  status: SUBSCRIPTION_STATUS.PAST_DUE,
  dunningStartedAt: DUNNING_STARTED_AT,
  nextRetryAt: dunningDay(FIRST_RETRY_DAY),
  dunningAttempt: 0,
} as const;

export const seedPastDue = (db: Database, overrides: Overrides = {}, tenant?: TenantFixture): Promise<Renewing> =>
  seedRenewing(db, { ...PAST_DUE, ...overrides }, tenant);
