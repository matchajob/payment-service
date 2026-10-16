import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINE_REASON, DECLINED } from '@tests/utils/declined-charge-fixtures';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { RENEWAL_CHARGE_REF, RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';

const THREE_DAYS = 3;
const LATE = new Date(PERIOD_END.getTime() + THREE_DAYS * DAY_MS);
const CLAMPED_PERIOD_END = new Date('2026-02-28T10:00:00.000Z');
const UNCLAMPED_NEXT_END = new Date('2026-03-31T10:00:00.000Z');
const LAST_DAY_ANCHOR = 31;
const RENEWAL_ATTEMPT = 0;
const FIRST_RETRY_AT = new Date('2026-02-16T10:00:00.000Z');

const setup = async (tx: Database, overrides: Parameters<typeof seedRenewing>[1] = {}) => {
  const providers = fakeProviderFactory();
  const renewing = await seedRenewing(tx, overrides);
  const provider = providers.providerOf(renewing.ctx.providerConnectionId);
  return { ...renewing, provider, renew: renewWith(tx, providers.providerFor) };
};

describe('runRenewal: a successful charge (S1 r5, Spec 2)', () => {
  it('charges the plan amount on the current card with the cycle dedup key for attempt 0', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription, cardToken, provider, renew } = await setup(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(PERIOD_END);
      expect(provider.calls.charge).toEqual([
        {
          paymentMethodToken: cardToken,
          amountMinor: ctx.plan.amountMinor,
          currency: ctx.plan.currency,
          dedupKey: `${subscription.subscriptionId}:${PERIOD_END.toISOString()}:${RENEWAL_ATTEMPT}`,
        },
      ]);
    });
  });

  it('advances from the old period end, not from now, when the cron runs three days late', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(LATE);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.SUCCEEDED,
          providerChargeRef: RENEWAL_CHARGE_REF,
          periodEnd: PERIOD_END,
          attempt: RENEWAL_ATTEMPT,
          attemptedAt: LATE,
        }),
      ]);
    });
  });

  it('returns to the anchor day after a month that clamped it (Jan 31 → Feb 28 → Mar 31)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx, {
        currentPeriodEnd: CLAMPED_PERIOD_END,
        anchorDay: LAST_DAY_ANCHOR,
      });
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(CLAMPED_PERIOD_END);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        currentPeriodEnd: UNCLAMPED_NEXT_END,
      });
    });
  });

  it('emits charge.succeeded carrying the advanced period', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(PERIOD_END);
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          eventType: OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED,
          sequence: 1,
          snapshot: expect.objectContaining({
            status: SUBSCRIPTION_STATUS.ACTIVE,
            currentPeriodEnd: NEXT_PERIOD_END.toISOString(),
          }),
        }),
      ]);
    });
  });
});

describe('runRenewal: a declined charge (S1 r6)', () => {
  it('moves to past_due, keeps the unpaid period, and stores the reason on the charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx);
      provider.scriptCharge(DECLINED);
      expect(await renew(PERIOD_END)).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
      });
    });
  });

  it('starts the dunning clock at the failed attempt and schedules retry 1 a day later (ADR 0014)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx);
      provider.scriptCharge(DECLINED);
      await renew(PERIOD_END);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        dunningStartedAt: PERIOD_END,
        nextRetryAt: FIRST_RETRY_AT,
        dunningAttempt: 0,
      });
      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.FAILED,
          failureReason: DECLINE_REASON,
          attempt: RENEWAL_ATTEMPT,
        }),
      ]);
    });
  });

  it('emits charge.failed, then subscription.past_due', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx);
      provider.scriptCharge(DECLINED);
      await renew(PERIOD_END);
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType, sequence }) => [eventType, sequence])).toEqual([
        [OUTBOUND_EVENT_TYPE.CHARGE_FAILED, 1],
        [OUTBOUND_EVENT_TYPE.SUBSCRIPTION_PAST_DUE, 2],
      ]);
    });
  });
});

describe('runRenewal: a subscription set to cancel (S1 r7)', () => {
  it('is canceled without calling the provider or writing a charge, and emits subscription.canceled', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, renew } = await setup(tx, { cancelAtPeriodEnd: true });
      expect(await renew(LATE)).toEqual({ processed: 1, failed: 0 });
      expect(provider.calls.charge).toEqual([]);
      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelAtPeriodEnd: false,
        canceledAt: LATE,
        cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
      });
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.SUBSCRIPTION_CANCELED]);
    });
  });
});
