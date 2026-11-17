import { eq } from 'drizzle-orm';
import type { Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import { invoicesTable } from '@/lib/invoices/schema';

export const invoicesOf = (db: Database, chargeId: Charge['chargeId']) =>
  db.select().from(invoicesTable).where(eq(invoicesTable.chargeId, chargeId));
