import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { after, GIVE_UP_MS, HOUR_MS, MINUTE_MS } from '@tests/utils/reconcile-times';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import {
  VERIFIED_PENDING,
  VERIFIED_SUCCEEDED,
  VERIFIED_WRONG_AMOUNT,
  VERIFIED_WRONG_CURRENCY,
} from '@tests/utils/verified-charge-fixtures';

const PINO_ERROR_LEVEL = 50;
const AN_HOUR_LATER = after(RENEWAL_ATTEMPTED_AT, HOUR_MS);
const ALMOST_A_WEEK = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS - MINUTE_MS);
const A_WEEK = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS);
const NOTHING_DONE = { processed: 0, failed: 0, flagged: 0 };
const FLAGGED_ONE = { processed: 0, failed: 0, flagged: 1 };

describe('runReconcile: a charge still pending at the provider (ADR 0017)', () => {
  it('leaves it pending under 7 days and asks again next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      provider.scriptVerify(VERIFIED_PENDING);
      provider.scriptVerify(VERIFIED_PENDING);
      const reconcile = reconcileWith(tx, providers.providerFor);

      expect(await reconcile(AN_HOUR_LATER)).toEqual(NOTHING_DONE);
      expect(await reconcile(ALMOST_A_WEEK)).toEqual(NOTHING_DONE);

      expect(provider.calls.verifyCharge).toHaveLength(2);
      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, reconcileFlag: null }),
      ]);
    });
  });

  it('flags it as stuck at 7 days', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      providers.providerOf(pending.ctx.providerConnectionId).scriptVerify(VERIFIED_PENDING);

      expect(await reconcileWith(tx, providers.providerFor)(A_WEEK)).toEqual(FLAGGED_ONE);

      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({
          status: CHARGE_STATUS.PENDING,
          reconcileFlag: RECONCILE_FLAG.STUCK_PENDING,
          flaggedAt: A_WEEK,
        }),
      ]);
    });
  });
});

describe('runReconcile: a success that does not match the charge (ADR 0017)', () => {
  it.each([
    ['amount', VERIFIED_WRONG_AMOUNT],
    ['currency', VERIFIED_WRONG_CURRENCY],
  ])('flags a success for another %s and does not settle it', async (_, verified) => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      providers.providerOf(pending.ctx.providerConnectionId).scriptVerify(verified);

      expect(await reconcileWith(tx, providers.providerFor)(AN_HOUR_LATER)).toEqual(FLAGGED_ONE);

      expect(await chargesOf(tx, pending.subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING, reconcileFlag: RECONCILE_FLAG.AMOUNT_MISMATCH }),
      ]);
      expect(await subscriptionRow(tx, pending.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: pending.subscription.currentPeriodEnd,
      });
      expect(await eventsOf(tx, pending.subscription.subscriptionId)).toEqual([]);
    });
  });
});

describe('runReconcile: what happens to a flag (ADR 0017)', () => {
  it('logs it at error level with the charge and the flag, so a human hears about it', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx);
      providers.providerOf(pending.ctx.providerConnectionId).scriptVerify(VERIFIED_PENDING);
      const log = capturingLogger();

      await reconcileWith(tx, providers.providerFor, log.logger)(A_WEEK);

      expect(log.lines()).toContainEqual(
        expect.objectContaining({
          level: PINO_ERROR_LEVEL,
          chargeId: pending.charge.chargeId,
          reconcileFlag: RECONCILE_FLAG.STUCK_PENDING,
        }),
      );
    });
  });

  it('never asks about a flagged charge again', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx, {
        reconcileFlag: RECONCILE_FLAG.STUCK_PENDING,
        flaggedAt: AN_HOUR_LATER,
      });
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(await reconcileWith(tx, providers.providerFor)(A_WEEK)).toEqual(NOTHING_DONE);

      expect(provider.calls.verifyCharge).toEqual([]);
    });
  });
});
