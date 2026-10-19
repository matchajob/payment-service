import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { hasLiveCharge } from '@/lib/charges/has-live-charge';
import { chargesTable, type Charge } from '@/lib/charges/schema';
import type { Database } from '@/lib/db';
import type { PaymentMethod } from '@/lib/payments-method/schema';
import type { Plan } from '@/lib/plans/schema';
import type { Subscription } from '@/lib/subscriptions/schema';
import { nextPeriodEnd } from '@/lib/subscriptions/next-period-end';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';

const NEXT = 1;
const NO_ROW = 'charge insert returned no row';

export type ImmediateRetryChargeInput = {
  subscription: Subscription;
  paymentMethodId: PaymentMethod['paymentMethodId'];
  plan: Plan;
  now: Date;
};

export const insertImmediateRetryCharge = async (
  tx: Database,
  { subscription, paymentMethodId, plan, now }: ImmediateRetryChargeInput,
): Promise<Charge | undefined> => {
  const periodEnd = nextPeriodEnd(subscription, plan);
  if (await hasLiveCharge(tx, subscription.subscriptionId, periodEnd)) return undefined;
  const [charge] = await tx
    .insert(chargesTable)
    .values({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.subscriptionId,
      providerConnectionId: subscription.providerConnectionId,
      paymentMethodId,
      kind: CHARGE_KIND.IMMEDIATE_RETRY,
      periodEnd,
      attempt: subscription.dunningAttempt + NEXT,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      status: CHARGE_STATUS.PENDING,
      providerChargeRef: null,
      failureReason: null,
      attemptedAt: now,
    })
    .returning();
  if (charge === undefined) throw new Error(NO_ROW);
  return charge;
};
