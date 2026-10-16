import { and, asc, eq, inArray, lte, notExists } from 'drizzle-orm';
import { chargesTable } from '@/lib/charges/schema';
import { LIVE_CHARGE_STATUSES } from '@/lib/charges/live-charge-statuses';
import type { Database } from '@/lib/db';
import { subscriptionsTable, type Subscription } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

export type DueRenewal = Pick<Subscription, 'subscriptionId' | 'providerConnectionId'>;

export const findDueRenewals = async (db: Database, now: Date, limit: number): Promise<DueRenewal[]> => {
  const liveCharge = db
    .select({ chargeId: chargesTable.chargeId })
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.subscriptionId, subscriptionsTable.subscriptionId),
        eq(chargesTable.periodEnd, subscriptionsTable.currentPeriodEnd),
        inArray(chargesTable.status, LIVE_CHARGE_STATUSES),
      ),
    );
  return db
    .select({
      subscriptionId: subscriptionsTable.subscriptionId,
      providerConnectionId: subscriptionsTable.providerConnectionId,
    })
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.status, SUBSCRIPTION_STATUS.ACTIVE),
        eq(subscriptionsTable.scheduleOwner, SCHEDULE_OWNER.SELF),
        lte(subscriptionsTable.currentPeriodEnd, now),
        notExists(liveCharge),
      ),
    )
    .orderBy(asc(subscriptionsTable.currentPeriodEnd))
    .limit(limit);
};
