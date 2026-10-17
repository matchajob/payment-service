import { and, eq, isNull } from 'drizzle-orm';
import { findCycleParties } from '@/lib/charge-cycle/find-cycle-parties';
import type { Database } from '@/lib/db';
import { REPLACEMENT, type Replacement } from '@/lib/payment-method-updates/replacement';
import { paymentMethodUpdatesTable, type PaymentMethodUpdate } from '@/lib/payment-method-updates/schema';
import { paymentMethodsTable } from '@/lib/payments-method/schema';
import { applyTransition } from '@/lib/subscriptions/apply-transition';
import { lockSubscription } from '@/lib/subscriptions/lock-subscription';
import { LIFECYCLE_EVENT } from '@/lib/subscriptions/state-machine/lifecycle-events';
import { OUTCOME_KIND } from '@/lib/subscriptions/state-machine/outcome';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { toState } from '@/lib/subscriptions/to-state';
import { transitionContextFor } from '@/lib/subscriptions/transition-context-for';
import { EFFECT } from '@/lib/subscriptions/state-machine/effects';
import { insertImmediateRetryCharge } from '@/lib/payment-method-updates/insert-immediate-retry-charge';

const MISSING = 'card update references a missing subscription';
const NO_ROW = 'insert returned no row';

export type ReplacePaymentMethodInput = { update: PaymentMethodUpdate; paymentMethodToken: string; now: Date };

export const replacePaymentMethod = (
  db: Database,
  { update, paymentMethodToken, now }: ReplacePaymentMethodInput,
): Promise<Replacement> =>
  db.transaction(async (tx) => {
    const subscription = await lockSubscription(tx, update.subscriptionId);
    if (subscription === undefined) throw new Error(MISSING);
    const completed = await tx
      .update(paymentMethodUpdatesTable)
      .set({ completedAt: now })
      .where(
        and(
          eq(paymentMethodUpdatesTable.paymentMethodUpdateId, update.paymentMethodUpdateId),
          isNull(paymentMethodUpdatesTable.completedAt),
        ),
      )
      .returning({ paymentMethodUpdateId: paymentMethodUpdatesTable.paymentMethodUpdateId });
    if (completed.length === 0) return { kind: REPLACEMENT.IGNORED };

    const parties = await findCycleParties(tx, subscription);
    const outcome = transition(
      toState(subscription),
      LIFECYCLE_EVENT.PAYMENT_METHOD_UPDATED,
      transitionContextFor(subscription, parties.tenant),
    );
    if (outcome.kind === OUTCOME_KIND.REJECTED) return { kind: REPLACEMENT.IGNORED };

    await tx
      .update(paymentMethodsTable)
      .set({ replacedAt: now })
      .where(
        and(
          eq(paymentMethodsTable.subscriptionId, subscription.subscriptionId),
          isNull(paymentMethodsTable.replacedAt),
        ),
      );
    const [card] = await tx
      .insert(paymentMethodsTable)
      .values({
        tenantId: subscription.tenantId,
        subscriptionId: subscription.subscriptionId,
        providerConnectionId: update.providerConnectionId,
        providerToken: paymentMethodToken,
        captureRef: update.sessionRef,
      })
      .returning();
    if (card === undefined) throw new Error(NO_ROW);
    await applyTransition(tx, {
      subscription,
      outcome,
      changes: {},
      customer: parties.customer,
      tenant: parties.tenant,
      occurredAt: now,
    });

    if (!outcome.effects.includes(EFFECT.RETRY_NOW)) return { kind: REPLACEMENT.REPLACED };
    const charge = await insertImmediateRetryCharge(tx, {
      subscription,
      paymentMethodId: card.paymentMethodId,
      plan: parties.plan,
      now,
    });
    if (charge === undefined) return { kind: REPLACEMENT.REPLACED };
    return { kind: REPLACEMENT.RETRY, charge, parties };
  });
