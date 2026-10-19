import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { NO_RETRIES_YET } from '@/lib/dunning/start-dunning';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { dunningDay, FINAL_RETRY_DAY, seedPastDue, SECOND_RETRY_DAY } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { paymentMethodsOf } from '@tests/utils/payment-method-reads';
import { after } from '@tests/utils/reconcile-times';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';

const RESCUE_DAY = 5;
const RESCUED_AT = dunningDay(RESCUE_DAY);
const RETRIES_SO_FAR = 2;
const RESCUE_ATTEMPT = RETRIES_SO_FAR + 1;
const SCHEDULE_DAYS = [1, 3, 7];
const tokenOf = (sessionRef: string) => `token-${sessionRef}`;

const seedTwoRetriesIn = (tx: Database) =>
  seedPastDue(tx, { dunningAttempt: RETRIES_SO_FAR, nextRetryAt: dunningDay(FINAL_RETRY_DAY) });

describe('card update completed for a past_due subscription: the immediate retry (S1 r14, ADR 0018)', () => {
  it("charges the new card at once, as the next attempt, with that attempt's dedup key", async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedTwoRetriesIn(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      await flow.complete(sessionRef);

      expect(flow.provider.calls.charge).toEqual([
        {
          paymentMethodToken: tokenOf(sessionRef),
          amountMinor: pastDue.ctx.plan.amountMinor,
          currency: pastDue.ctx.plan.currency,
          dedupKey: `${pastDue.subscription.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:${RESCUE_ATTEMPT}`,
        },
      ]);
    });
  });

  it('on success: active again, the new period counted from the original period end, dunning cleared', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedTwoRetriesIn(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect((await flow.complete(sessionRef)).status).toBe(200);

      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
        dunningAttempt: NO_RETRIES_YET,
        dunningAttemptBase: NO_RETRIES_YET,
        dunningStartedAt: null,
        nextRetryAt: null,
      });
      const [, newCard] = await paymentMethodsOf(tx, pastDue.subscription.subscriptionId);
      expect(await chargesOf(tx, pastDue.subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.SUCCEEDED,
          kind: CHARGE_KIND.IMMEDIATE_RETRY,
          periodEnd: NEXT_PERIOD_END,
          attempt: RESCUE_ATTEMPT,
          paymentMethodId: newCard?.paymentMethodId,
          attemptedAt: RESCUED_AT,
        }),
      ]);
    });
  });

  it('on success: emits charge.succeeded', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedTwoRetriesIn(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(RENEWAL_SUCCEEDED);

      await flow.complete(sessionRef);

      const events = await eventsOf(tx, pastDue.subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED]);
    });
  });

  it('on failure: stays past_due, emits charge.failed, and restarts the clock at the failure', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedTwoRetriesIn(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(DECLINED);

      await flow.complete(sessionRef);

      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
        dunningStartedAt: RESCUED_AT,
        dunningAttempt: RESCUE_ATTEMPT,
        dunningAttemptBase: RESCUE_ATTEMPT,
        nextRetryAt: after(RESCUED_AT, DAY_MS),
      });
      const events = await eventsOf(tx, pastDue.subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.CHARGE_FAILED]);
    });
  });

  it('after a failed rescue, the full schedule runs again from the update (+1d, +3d, +7d), then cancels', async () => {
    await withRollback(testDb(), async (tx) => {
      const pastDue = await seedTwoRetriesIn(tx);
      const flow = cardUpdateFlow(tx, pastDue, RESCUED_AT);
      const sessionRef = await flow.start();
      flow.provider.scriptCharge(DECLINED);
      await flow.complete(sessionRef);
      const dun = dunWith(tx, flow.providers.providerFor);
      SCHEDULE_DAYS.forEach(() => flow.provider.scriptCharge(DECLINED));

      await dun(after(RESCUED_AT, DAY_MS));
      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        nextRetryAt: after(RESCUED_AT, SECOND_RETRY_DAY * DAY_MS),
      });
      await dun(after(RESCUED_AT, SECOND_RETRY_DAY * DAY_MS));
      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        nextRetryAt: after(RESCUED_AT, FINAL_RETRY_DAY * DAY_MS),
      });
      await dun(after(RESCUED_AT, FINAL_RETRY_DAY * DAY_MS));

      expect(await subscriptionRow(tx, pastDue.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      });
      const attempts = flow.provider.calls.charge.map(({ dedupKey }) => Number(dedupKey.split(':').at(-1)));
      expect(attempts).toEqual([RESCUE_ATTEMPT, RESCUE_ATTEMPT + 1, RESCUE_ATTEMPT + 2, RESCUE_ATTEMPT + 3]);
    });
  });
});
