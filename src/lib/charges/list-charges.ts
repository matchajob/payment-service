import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { ChargeStatus } from '@/lib/charges/charge-status';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { keysetBefore } from '@/lib/pagination/keyset-before';
import { listed, oneMoreThan, UNKNOWN_CURSOR, type ListFilter, type ListResult } from '@/lib/pagination/list-result';
import type { Tenant } from '@/lib/tenants/schema';

export type ChargeListFilter = ListFilter<Charge['chargeId']> & { status?: ChargeStatus | undefined };

const cursor = alias(chargesTable, 'cursor');

export const listCharges = async (
  db: Database,
  tenantId: Tenant['tenantId'],
  { limit, startingAfter, status }: ChargeListFilter,
): Promise<ListResult<Charge>> => {
  const cursorKeys =
    startingAfter === undefined
      ? undefined
      : db
          .select({ chargeSerial: cursor.chargeSerial })
          .from(cursor)
          .where(and(eq(cursor.tenantId, tenantId), eq(cursor.chargeId, startingAfter)));
  if (cursorKeys !== undefined && (await cursorKeys).length === 0) return UNKNOWN_CURSOR;
  const rows = await db
    .select()
    .from(chargesTable)
    .where(
      and(
        eq(chargesTable.tenantId, tenantId),
        status === undefined ? undefined : eq(chargesTable.status, status),
        cursorKeys === undefined ? undefined : keysetBefore([chargesTable.chargeSerial], cursorKeys),
      ),
    )
    .orderBy(desc(chargesTable.chargeSerial))
    .limit(oneMoreThan(limit));
  return listed(rows, limit);
};
