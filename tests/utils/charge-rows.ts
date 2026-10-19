import type { Database } from '@/lib/db';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import { CURRENCY } from '@/lib/money/currency';
import { insertPaymentMethod, seedSubscriptionOwner } from '@tests/utils/payment-method-rows';
import { ACME, type TenantFixture } from '@tests/utils/tenant-fixtures';

type NewCharge = typeof chargesTable.$inferInsert;
export type ChargeOwner = Pick<NewCharge, 'tenantId' | 'subscriptionId' | 'paymentMethodId' | 'providerConnectionId'>;
type ChargeOverrides = Partial<Omit<NewCharge, keyof ChargeOwner>>;

export const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');
export const ATTEMPTED_AT = new Date('2026-01-15T10:00:00.000Z');

export const seedChargeOwner = async (db: Database, tenant: TenantFixture = ACME): Promise<ChargeOwner> => {
  const owner = await seedSubscriptionOwner(db, tenant);
  const [card] = await insertPaymentMethod(db, owner, 'session-1').returning();
  if (card === undefined) throw new Error('payment method insert returned no row');
  return { ...owner, paymentMethodId: card.paymentMethodId };
};

export const insertCharge = (db: Database, owner: ChargeOwner, overrides: ChargeOverrides = {}) =>
  db.insert(chargesTable).values({
    ...owner,
    kind: CHARGE_KIND.FIRST,
    periodEnd: PERIOD_END,
    attempt: 0,
    amountMinor: 4900,
    currency: CURRENCY.ILS,
    status: CHARGE_STATUS.SUCCEEDED,
    providerChargeRef: 'charge-1',
    failureReason: null,
    attemptedAt: ATTEMPTED_AT,
    ...overrides,
  });
