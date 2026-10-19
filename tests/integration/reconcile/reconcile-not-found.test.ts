import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { NOT_FOUND_REASON } from '@/lib/charges/not-found-reason';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { FIRST_CHARGE_AT, RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingFirstCharge, seedPendingRenewal, type PendingCharge } from '@tests/utils/pending-charge-rows';
import { after, GIVE_UP_MS, MINUTE_MS, NOT_FOUND_GRACE_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { NEXT_PERIOD_END } from '@tests/utils/renewal-rows';
import { chargesAfterHistory, chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { VERIFIED_NOT_FOUND } from '@tests/utils/verified-charge-fixtures';

const PROVIDER_REF = 'provider-charge-7';
const JUST_INSIDE_GRACE = after(RENEWAL_ATTEMPTED_AT, NOT_FOUND_GRACE_MS - MINUTE_MS);
const GRACE_OVER = after(RENEWAL_ATTEMPTED_AT, NOT_FOUND_GRACE_MS);
const FIRST_CHARGE_GRACE_OVER = after(FIRST_CHARGE_AT, NOT_FOUND_GRACE_MS);
const LONG_AFTER = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };
const FLAGGED_ONE = { processed: 0, failed: 0, flagged: 1 };

const reconcilerFor = (tx: Database, pending: PendingCharge) => {
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(pending.ctx.providerConnectionId);
  return { provider, reconcile: reconcileWith(tx, providers.providerFor) };
};

describe('runReconcile: a timed-out charge the provider cannot find (ADR 0017)', () => {
  it('asks by the dedup key, with no provider reference', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      await reconcile(JUST_INSIDE_GRACE);

      expect(provider.calls.verifyCharge).toEqual([
        {
          dedupKey: `${pending.subscription.subscriptionId}:${NEXT_PERIOD_END.toISOString()}:0`,
          providerChargeRef: null,
          paymentMethodToken: pending.cardToken,
          chargeSerial: pending.charge.chargeSerial,
        },
      ]);
    });
  });

  it('leaves it pending inside the 24h grace: the provider may not have indexed it yet', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      expect(await reconcile(JUST_INSIDE_GRACE)).toEqual(NOTHING_DONE);

      expect(await chargesAfterHistory(tx, pending)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, reconcileFlag: null }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
      expect(await eventsOf(tx, pending.subscription.subscriptionId)).toEqual([]);
    });
  });

  it('fails it once the grace is over, with the not-found reason, and the subscription goes past_due (decision X)', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      expect(await reconcile(GRACE_OVER)).toEqual({ processed: 1, failed: 0, flagged: 0 });

      expect(await chargesAfterHistory(tx, pending)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: NOT_FOUND_REASON }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        dunningStartedAt: GRACE_OVER,
      });
    });
  });

  it('cancels a subscription whose lost charge was charge #1', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingFirstCharge(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      await reconcile(FIRST_CHARGE_GRACE_OVER);

      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      });
    });
  });
});

describe('runReconcile: a charge reconcile cannot look up (ADR 0017)', () => {
  it('flags a charge with no reference on a provider without reference lookup, and never asks', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx);
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.withoutReferenceLookup();

      expect(await reconcile(GRACE_OVER)).toEqual(FLAGGED_ONE);

      expect(provider.calls.verifyCharge).toEqual([]);
      expect(await chargesAfterHistory(tx, pending)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.PENDING,
          reconcileFlag: RECONCILE_FLAG.NO_REFERENCE_LOOKUP,
          flaggedAt: GRACE_OVER,
        }),
      ]);
    });
  });

  it('still asks by the reference on that provider when the charge has one', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx, { providerChargeRef: PROVIDER_REF });
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.withoutReferenceLookup();
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      await reconcile(JUST_INSIDE_GRACE);

      expect(provider.calls.verifyCharge).toEqual([expect.objectContaining({ providerChargeRef: PROVIDER_REF })]);
    });
  });

  it('flags a charge with a provider reference that the provider cannot find, and never fails it', async () => {
    await withRollback(testDb(), async (tx) => {
      const pending = await seedPendingRenewal(tx, { providerChargeRef: PROVIDER_REF });
      const { provider, reconcile } = reconcilerFor(tx, pending);
      provider.scriptVerify(VERIFIED_NOT_FOUND);

      expect(await reconcile(LONG_AFTER)).toEqual(FLAGGED_ONE);

      expect(await chargesAfterHistory(tx, pending)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, reconcileFlag: RECONCILE_FLAG.REF_NOT_FOUND }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
    });
  });
});
