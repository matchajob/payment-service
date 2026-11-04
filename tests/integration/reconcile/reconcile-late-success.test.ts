import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import type { Database } from '@/lib/db';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { DAY_MS } from '@/lib/time/day-ms';
import { insertCycleCharge } from '@tests/utils/cycle-charge-insert';
import { testDb, withRollback } from '@tests/utils/db';
import { DECLINE_REASON } from '@tests/utils/declined-charge-fixtures';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import {
  FIRST_CHARGE_AT,
  FIRST_RETRY,
  RENEWAL_ATTEMPTED_AT,
  RETRY_ATTEMPTED_AT,
} from '@tests/utils/pending-charge-shapes';
import { seedLostRenewal, seedPendingFirstCharge, type PendingCharge } from '@tests/utils/pending-charge-rows';
import { after, GIVE_UP_MS, NOT_FOUND_GRACE_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesAfterHistory, chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END } from '@tests/utils/renewal-rows';
import {
  VERIFIED_CHARGE_REF,
  VERIFIED_NOT_FOUND,
  VERIFIED_SUCCEEDED,
  VERIFIED_WRONG_AMOUNT,
  VERIFIED_WRONG_CURRENCY,
} from '@tests/utils/verified-charge-fixtures';

const THREE_DAYS = 3;
const THREE_DAYS_LATER = after(RENEWAL_ATTEMPTED_AT, THREE_DAYS * DAY_MS);
const A_WEEK_LATER = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };

const reconcilerFor = (tx: Database, lost: PendingCharge) => {
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(lost.ctx.providerConnectionId);
  return { provider, reconcile: reconcileWith(tx, providers.providerFor) };
};

describe('runReconcile: the late-success sweep over lost charges (ADR 0017 decision 6)', () => {
  it('recovers the past_due subscription when its lost renewal turns out to have succeeded (code-review-1 M9)', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, lost);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcile(THREE_DAYS_LATER)).toEqual({ processed: 1, failed: 0, flagged: 0 });

      expect(await chargesAfterHistory(tx, lost)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.SUCCEEDED,
          providerChargeRef: VERIFIED_CHARGE_REF,
          failureReason: null,
          reconcileFlag: null,
        }),
      ]);
      expect(await subscriptionRow(tx, lost.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
        nextRetryAt: null,
        dunningStartedAt: null,
      });
      expect(await eventsOf(tx, lost.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ eventType: OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED }),
      ]);
      expect(provider.calls.charge).toEqual([]);
    });
  });

  it.each([
    ['a different amount', VERIFIED_WRONG_AMOUNT],
    ['a different currency', VERIFIED_WRONG_CURRENCY],
  ])('flags it instead when the provider reports %s, and changes nothing else', async (_, verified) => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, lost);
      provider.scriptVerify(verified);

      expect(await reconcile(THREE_DAYS_LATER)).toEqual({ processed: 0, failed: 0, flagged: 1 });

      expect(await chargesAfterHistory(tx, lost)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.FAILED,
          failureReason: NOT_FOUND_REASON,
          reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS,
          flaggedAt: THREE_DAYS_LATER,
        }),
      ]);
      expect(await subscriptionRow(tx, lost.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: lost.subscription.currentPeriodEnd,
      });
      expect(await eventsOf(tx, lost.subscription.subscriptionId)).toEqual([]);
    });
  });

  it('flags it instead while a retry for the same period is in flight, which could charge the customer twice', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      await insertCycleCharge(tx, lost, FIRST_RETRY, { attemptedAt: THREE_DAYS_LATER });
      const { provider, reconcile } = reconcilerFor(tx, lost);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcile(THREE_DAYS_LATER)).toEqual({ processed: 0, failed: 0, flagged: 1 });

      expect(await subscriptionRow(tx, lost.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
      });
    });
  });

  it('leaves it alone while the provider still cannot find it', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, lost);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      expect(await reconcile(THREE_DAYS_LATER)).toEqual(NOTHING_DONE);

      expect(await chargesAfterHistory(tx, lost)).toEqual([expect.objectContaining({ reconcileFlag: null })]);
    });
  });

  it('stops asking 7 days after the attempt', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, lost);

      expect(await reconcile(A_WEEK_LATER)).toEqual(NOTHING_DONE);

      expect(provider.calls.verifyCharge).toEqual([]);
    });
  });

  it('never re-checks a charge the card actually declined', async () => {
    await withRollback(testDb(), async (tx) => {
      const declined = await seedLostRenewal(tx, { failureReason: DECLINE_REASON });
      const { provider, reconcile } = reconcilerFor(tx, declined);

      expect(await reconcile(THREE_DAYS_LATER)).toEqual(NOTHING_DONE);

      expect(provider.calls.verifyCharge).toEqual([]);
    });
  });
});

describe('runReconcile: a late success after dunning already collected the period (ADR 0017 decision 6)', () => {
  it('flags the lost renewal and leaves the rescued subscription, its retry and its events alone', async () => {
    await withRollback(testDb(), async (tx) => {
      const lost = await seedLostRenewal(tx);
      const providers = fakeProviderFactory();
      const provider = providers.providerOf(lost.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await dunWith(tx, providers.providerFor)(RETRY_ATTEMPTED_AT);
      const eventsBefore = await eventsOf(tx, lost.subscription.subscriptionId);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcileWith(tx, providers.providerFor)(THREE_DAYS_LATER)).toEqual({
        processed: 0,
        failed: 0,
        flagged: 1,
      });

      expect(await chargesAfterHistory(tx, lost)).toEqual([
        expect.objectContaining({
          kind: CHARGE_KIND.RENEWAL,
          status: CHARGE_STATUS.FAILED,
          reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS,
        }),
        expect.objectContaining({ kind: CHARGE_KIND.RETRY, status: CHARGE_STATUS.SUCCEEDED, reconcileFlag: null }),
      ]);
      expect(await subscriptionRow(tx, lost.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
      expect(await eventsOf(tx, lost.subscription.subscriptionId)).toEqual(eventsBefore);
      expect(provider.calls.charge).toHaveLength(1);
    });
  });
});

describe('runReconcile: a late success on charge #1 of a subscription it already canceled (code-review-1 M9)', () => {
  it('flags it for a refund and keeps the subscription canceled, since canceled is terminal', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingFirstCharge(tx);
      const providers = fakeProviderFactory();
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      const reconcile = reconcileWith(tx, providers.providerFor);
      provider.scriptVerify(VERIFIED_NOT_FOUND);
      await reconcile(after(FIRST_CHARGE_AT, NOT_FOUND_GRACE_MS));
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcile(after(FIRST_CHARGE_AT, THREE_DAYS * DAY_MS))).toEqual({
        processed: 0,
        failed: 0,
        flagged: 1,
      });

      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
      });
    });
  });
});
