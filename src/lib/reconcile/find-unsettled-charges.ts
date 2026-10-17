import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { RECONCILE_WINDOW } from '@/lib/reconcile/reconcile-windows';

export const findUnsettledCharges = (db: Database, now: Date, limit: number): Promise<Charge[]> =>
  db
    .select()
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.status, CHARGE_STATUS.PENDING),
        isNull(chargesTable.reconcileFlag),
        lte(chargesTable.attemptedAt, new Date(now.getTime() - RECONCILE_WINDOW.IN_FLIGHT_MS)),
      ),
    )
    .orderBy(asc(chargesTable.attemptedAt))
    .limit(limit);
