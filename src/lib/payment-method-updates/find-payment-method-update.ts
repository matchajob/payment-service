import { and, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { paymentMethodUpdatesTable, type PaymentMethodUpdate } from '@/lib/payment-method-updates/schema';

export const findPaymentMethodUpdate = async (
  db: Database,
  providerConnectionId: PaymentMethodUpdate['providerConnectionId'],
  sessionRef: string,
): Promise<PaymentMethodUpdate | undefined> => {
  const [update] = await db
    .select()
    .from(paymentMethodUpdatesTable)
    .where(
      and(
        eq(paymentMethodUpdatesTable.providerConnectionId, providerConnectionId),
        eq(paymentMethodUpdatesTable.sessionRef, sessionRef),
      ),
    )
    .limit(1);
  return update;
};
