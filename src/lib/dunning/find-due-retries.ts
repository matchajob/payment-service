import { and, asc, eq, lte } from 'drizzle-orm';
import type { DueCharge } from '@/lib/charge-cycle/charge-cycle';
import { noLiveChargeForCurrentPeriod } from '@/lib/charge-cycle/no-live-charge-for-current-period';
import type { Database } from '@/lib/db';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export const findDueRetries = (db: Database, now: Date, limit: number): Promise<DueCharge[]> =>
  db
    .select({
      subscriptionId: subscriptionsTable.subscriptionId,
      providerConnectionId: subscriptionsTable.providerConnectionId,
    })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.status, SUBSCRIPTION_STATUS.PAST_DUE),
        eq(subscriptionsTable.scheduleOwner, SCHEDULE_OWNER.SELF),
        lte(subscriptionsTable.nextRetryAt, now),
        noLiveChargeForCurrentPeriod(db),
      ),
    )
    .orderBy(asc(subscriptionsTable.nextRetryAt))
    .limit(limit);
