import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { RECONCILE_WINDOW } from '@/lib/reconcile/reconcile-windows';

export const findLostCharges = (db: Database, now: Date, limit: number): Promise<Charge[]> =>
  db
    .select()
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.status, CHARGE_STATUS.FAILED),
        eq(chargesTable.failureReason, NOT_FOUND_REASON),
        isNull(chargesTable.reconcileFlag),
        gt(chargesTable.attemptedAt, new Date(now.getTime() - RECONCILE_WINDOW.GIVE_UP_MS)),
      ),
    )
    .orderBy(asc(chargesTable.attemptedAt))
    .limit(limit);
