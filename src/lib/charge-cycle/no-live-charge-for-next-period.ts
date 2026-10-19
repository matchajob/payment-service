import { and, eq, gt, inArray, notExists } from 'drizzle-orm';
import { LIVE_CHARGE_STATUSES } from '@/lib/charges/live-charge-statuses';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { subscriptionsTable } from '@/lib/subscriptions/schema';

export const noLiveChargeForNextPeriod = (db: Database) =>
  notExists(
    db
      .select({ chargeId: chargesTable.chargeId })
      .from(chargesTable)
      .where(
        and(
          eq(chargesTable.subscriptionId, subscriptionsTable.subscriptionId),
          gt(chargesTable.periodEnd, subscriptionsTable.currentPeriodEnd),
          inArray(chargesTable.status, LIVE_CHARGE_STATUSES),
        ),
      ),
  );
