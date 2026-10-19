import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINE_REASON, DECLINED } from '@tests/utils/declined-charge-fixtures';
import { dunningDay, FINAL_RETRY_DAY, FIRST_RETRY_DAY, SECOND_RETRY_DAY } from '@tests/utils/dunning-days';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';

const RESCUE_DAY = 5;
const FIRST_RETRY = 1;
const SECOND_RETRY = 2;
const FINAL_RETRY = 3;
const NOT_DUNNING = { dunningAttempt: 0, nextRetryAt: null, dunningStartedAt: null };

const setup = async (tx: Database, overrides: Parameters<typeof seedPastDue>[1] = {}) => {
  const providers = fakeProviderFactory();
  const pastDue = await seedPastDue(tx, overrides);
  const provider = providers.providerOf(pastDue.ctx.providerConnectionId);
  return { ...pastDue, provider, dun: dunWith(tx, providers.providerFor) };
};

const beforeSecondRetry = { dunningAttempt: FIRST_RETRY, nextRetryAt: dunningDay(SECOND_RETRY_DAY) };
const beforeFinalRetry = { dunningAttempt: SECOND_RETRY, nextRetryAt: dunningDay(FINAL_RETRY_DAY) };

describe('runDunning: the charge (S1 r10, Spec 1 double-charge guards)', () => {
  it('charges the plan amount on the current card with the dedup key for the next attempt', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription, cardToken, provider, dun } = await setup(tx, beforeSecondRetry);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await dun(dunningDay(SECOND_RETRY_DAY));
      expect(provider.calls.charge).toEqual([
        {
          paymentMethodToken: cardToken,
          amountMinor: ctx.plan.amountMinor,
          currency: ctx.plan.currency,
          dedupKey: `${subscription.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:${SECOND_RETRY}`,
        },
      ]);
    });
  });
});

describe('runDunning: a rescue (S1 r10, D7)', () => {
  it('ends the new period one interval after the old end, even when the rescue lands on day 5', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun, history } = await setup(tx, beforeSecondRetry);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      expect(await dun(dunningDay(RESCUE_DAY))).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
        ...NOT_DUNNING,
      });
      expect(await chargesAfterHistory(tx, { subscription, history })).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.SUCCEEDED,
          kind: CHARGE_KIND.RETRY,
          periodEnd: NEXT_PERIOD_END,
          attempt: SECOND_RETRY,
        }),
      ]);
    });
  });

  it('emits charge.succeeded with an active, entitled snapshot', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun } = await setup(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await dun(dunningDay(FIRST_RETRY_DAY));
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          eventType: OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED,
          snapshot: expect.objectContaining({ status: SUBSCRIPTION_STATUS.ACTIVE, entitled: true }),
        }),
      ]);
    });
  });
});

describe('runDunning: a failed retry that is not the last (ADR 0014)', () => {
  it('stays past_due and schedules the next retry from attempt 0, not from this retry', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun, history } = await setup(tx);
      provider.scriptCharge(DECLINED);
      expect(await dun(dunningDay(FIRST_RETRY_DAY))).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
        dunningAttempt: FIRST_RETRY,
        nextRetryAt: dunningDay(SECOND_RETRY_DAY),
      });
      expect(await chargesAfterHistory(tx, { subscription, history })).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: DECLINE_REASON, attempt: FIRST_RETRY }),
      ]);
    });
  });

  it('emits charge.failed so the tenant can nudge the customer after every attempt', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun } = await setup(tx);
      provider.scriptCharge(DECLINED);
      await dun(dunningDay(FIRST_RETRY_DAY));
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          eventType: OUTBOUND_EVENT_TYPE.CHARGE_FAILED,
          snapshot: expect.objectContaining({ status: SUBSCRIPTION_STATUS.PAST_DUE }),
        }),
      ]);
    });
  });
});

describe('runDunning: the final retry fails (S1 r11)', () => {
  it('cancels with reason payment_failure and stops dunning', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun } = await setup(tx, beforeFinalRetry);
      provider.scriptCharge(DECLINED);
      await dun(dunningDay(FINAL_RETRY_DAY));
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
        canceledAt: dunningDay(FINAL_RETRY_DAY),
        dunningAttempt: FINAL_RETRY,
        nextRetryAt: null,
        dunningStartedAt: null,
      });
    });
  });

  it('emits charge.failed, then subscription.canceled carrying the reason', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, dun } = await setup(tx, beforeFinalRetry);
      provider.scriptCharge(DECLINED);
      await dun(dunningDay(FINAL_RETRY_DAY));
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([
        OUTBOUND_EVENT_TYPE.CHARGE_FAILED,
        OUTBOUND_EVENT_TYPE.SUBSCRIPTION_CANCELED,
      ]);
      expect(events.at(-1)?.snapshot).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
        entitled: false,
      });
    });
  });
});
