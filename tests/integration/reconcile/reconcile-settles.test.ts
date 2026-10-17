import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { testDb, withRollback } from '@tests/utils/db';
import { dunningDay, SECOND_RETRY_DAY } from '@tests/utils/dunning-rows';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import {
  FIRST_CHARGE_AT,
  RENEWAL_ATTEMPTED_AT,
  RETRY_ATTEMPTED_AT,
  seedPendingFirstCharge,
  seedPendingRenewal,
  seedPendingRetry,
  type PendingCharge,
} from '@tests/utils/pending-charge-rows';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';
import {
  VERIFIED_CHARGE_REF,
  VERIFIED_DECLINE_REASON,
  VERIFIED_FAILED,
  VERIFIED_SUCCEEDED,
} from '@tests/utils/verified-charge-fixtures';

const TWO_DAYS = 2;
const SETTLED_ONE = { processed: 1, failed: 0, flagged: 0 };
const AN_HOUR_AFTER_RENEWAL = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);
const TWO_DAYS_AFTER_RENEWAL = after(RENEWAL_ATTEMPTED_AT, TWO_DAYS * DAY_MS);
const AN_HOUR_AFTER_FIRST_CHARGE = after(FIRST_CHARGE_AT, HOUR_MS);
const AN_HOUR_AFTER_RETRY = after(RETRY_ATTEMPTED_AT, HOUR_MS);

const reconcilerFor = (tx: Database, pending: PendingCharge) => {
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(pending.ctx.providerConnectionId);
  return { provider, reconcile: reconcileWith(tx, providers.providerFor) };
};

describe('runReconcile: a pending renewal charge (Spec 4 rule 8, ADR 0017)', () => {
  it('settles a charge the provider says succeeded and advances the period', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcile(AN_HOUR_AFTER_RENEWAL)).toEqual(SETTLED_ONE);

      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED, providerChargeRef: VERIFIED_CHARGE_REF }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
      const events = await eventsOf(tx, pending.subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED]);
    });
  });

  it('advances from the old period end, not from now, when it settles two days late', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      await reconcile(TWO_DAYS_AFTER_RENEWAL);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        currentPeriodEnd: NEXT_PERIOD_END,
      });
    });
  });

  it('never charges: it only asks', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      await reconcile(AN_HOUR_AFTER_RENEWAL);

      expect(provider.calls.charge).toEqual([]);
    });
  });

  it('moves to past_due on a provider failure and stores its reason on the charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_FAILED);

      expect(await reconcile(AN_HOUR_AFTER_RENEWAL)).toEqual(SETTLED_ONE);

      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: VERIFIED_DECLINE_REASON }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
      });
      const events = await eventsOf(tx, pending.subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([
        OUTBOUND_EVENT_TYPE.CHARGE_FAILED,
        OUTBOUND_EVENT_TYPE.SUBSCRIPTION_PAST_DUE,
      ]);
    });
  });

  it('starts the dunning clock when it learns of the failure, not at the attempt, so no retry is already overdue', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_FAILED);

      await reconcile(TWO_DAYS_AFTER_RENEWAL);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        dunningStartedAt: TWO_DAYS_AFTER_RENEWAL,
        nextRetryAt: after(TWO_DAYS_AFTER_RENEWAL, DAY_MS),
        dunningAttempt: 0,
      });
    });
  });
});

describe('runReconcile: a pending charge #1 (S1 r2, ADR 0008)', () => {
  it('settles as the first charge: stays on period 1 and emits subscription.activated', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingFirstCharge(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcile(AN_HOUR_AFTER_FIRST_CHARGE)).toEqual(SETTLED_ONE);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
      });
      const events = await eventsOf(tx, pending.subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.SUBSCRIPTION_ACTIVATED]);
    });
  });

  it('cancels for payment failure when charge #1 failed', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingFirstCharge(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_FAILED);

      await reconcile(AN_HOUR_AFTER_FIRST_CHARGE);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        canceledAt: AN_HOUR_AFTER_FIRST_CHARGE,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      });
    });
  });
});

describe('runReconcile: a pending dunning retry (ADR 0014)', () => {
  it('ends dunning on success and starts the new period from the original period end', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRetry(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      await reconcile(AN_HOUR_AFTER_RETRY);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
        dunningAttempt: 0,
        dunningStartedAt: null,
        nextRetryAt: null,
      });
    });
  });

  it('schedules the next retry on the original dunning clock when the retry failed', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRetry(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_FAILED);

      await reconcile(AN_HOUR_AFTER_RETRY);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        dunningAttempt: 1,
        nextRetryAt: dunningDay(SECOND_RETRY_DAY),
      });
    });
  });
});
