import { and, eq, inArray, notExists } from 'drizzle-orm';
import { LIVE_CHARGE_STATUSES } from '@/lib/charges/live-charge-statuses';
import { chargesTable } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { subscriptionsTable } from '@/lib/subscriptions/schema';

export const noLiveChargeForCurrentPeriod = (db: Database) =>
  notExists(
    db
      .select({ chargeId: chargesTable.chargeId })
      .from(chargesTable)
      .where(
        and(
          eq(chargesTable.subscriptionId, subscriptionsTable.subscriptionId),
          eq(chargesTable.periodEnd, subscriptionsTable.currentPeriodEnd),
          inArray(chargesTable.status, LIVE_CHARGE_STATUSES),
        ),
      ),
  );
