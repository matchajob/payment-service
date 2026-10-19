import { eq } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { paymentMethodsTable, type PaymentMethod } from '@/lib/payments-method/schema';

const MISSING_PAYMENT_METHOD = 'charge references a missing payment method';

export const findPaymentMethodToken = async (
  db: Database,
  paymentMethodId: PaymentMethod['paymentMethodId'],
): Promise<PaymentMethod['providerToken']> => {
  const [card] = await db
    .select({ providerToken: paymentMethodsTable.providerToken })
    .from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.paymentMethodId, paymentMethodId))
    .limit(1);
  if (card === undefined) throw new Error(MISSING_PAYMENT_METHOD);
  return card.providerToken;
};
