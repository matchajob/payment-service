import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { chargesTable } from '@/lib/charges/schema';
import type { Customer } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { isUniqueViolation } from '@/lib/is-unique-violation';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import type { Plan } from '@/lib/plans/schema';
import { ACTIVATION, type Activation } from '@/lib/subscriptions/activation';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { startPeriod } from '@/lib/subscriptions/period';
import { ONE_LIVE_PER_CUSTOMER, type Subscription } from '@/lib/subscriptions/schema';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import type { Tenant } from '@/lib/tenants/schema';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';

const FIRST_ATTEMPT = 0;

export type ActivateCheckoutInput = {
  subscriptionId: Subscription['subscriptionId'];
  sessionRef: string;
  paymentMethodToken: string;
  tenant: Tenant;
  customer: Customer;
  plan: Plan;
  now: Date;
};

export const activateCheckout = async (db: Database, input: ActivateCheckoutInput): Promise<Activation> => {
  try {
    return await db.transaction(async (tx) => {
      const subscription = await lockSubscription(tx, input.subscriptionId);
      if (subscription?.status !== SUBSCRIPTION_STATUS.INCOMPLETE) return { kind: ACTIVATION.RACED };
      const outcome = transition(
        toState(subscription),
        LIFECYCLE_EVENT.CHECKOUT_COMPLETED,
        transitionContextFor(subscription, input.tenant),
      );
      if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: ACTIVATION.RACED };

      const [card] = await tx
        .insert(paymentMethodsTable)
        .values({
          tenantId: subscription.tenantId,
          subscriptionId: subscription.subscriptionId,
          providerConnectionId: subscription.providerConnectionId,
          providerToken: input.paymentMethodToken,
          captureRef: input.sessionRef,
        })
        .returning();
      if (card === undefined) throw new Error('payment method insert returned no row');

      const { periodEnd, anchorDay } = startPeriod(input.now, input.plan.interval);
      await applyTransition(tx, {
        subscription,
        outcome,
        changes: { currentPeriodEnd: periodEnd, anchorDay },
        customer: input.customer,
        tenant: input.tenant,
        occurredAt: input.now,
      });

      const [charge] = await tx
        .insert(chargesTable)
        .values({
          kind: CHARGE_KIND.FIRST,
          tenantId: subscription.tenantId,
          subscriptionId: subscription.subscriptionId,
          providerConnectionId: subscription.providerConnectionId,
          paymentMethodId: card.paymentMethodId,
          periodEnd,
          attempt: FIRST_ATTEMPT,
          amountMinor: input.plan.amountMinor,
          currency: input.plan.currency,
          status: CHARGE_STATUS.PENDING,
          providerChargeRef: null,
          failureReason: null,
          attemptedAt: input.now,
        })
        .returning();
      if (charge === undefined) throw new Error('charge insert returned no row');
      return { kind: ACTIVATION.ACTIVATED, charge };
    });
  } catch (error) {
    if (isUniqueViolation(error, ONE_LIVE_PER_CUSTOMER)) return { kind: ACTIVATION.ALREADY_SUBSCRIBED };
    throw error;
  }
};
