import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import { zChargeRead } from '@/lib/charges/schema';
import { SETTLE_FLAGGED } from '@/lib/reconcile/settle-flagged-outcome';
import { settleFlaggedCharge } from '@/lib/reconcile/settle-flagged-charge';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedLostRenewal, seedPendingFirstCharge, seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { after, GIVE_UP_MS } from '@tests/utils/reconcile-times';
import { chargesOf, eventsOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END } from '@tests/utils/renewal-rows';

const FLAGGED_AT = after(RENEWAL_ATTEMPTED_AT, GIVE_UP_MS);
const SETTLED_AT = after(FLAGGED_AT, GIVE_UP_MS);
const STUCK = { reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: FLAGGED_AT } as const;
const CONFIRMED_REF = 'grow-tx-123';
const RECORDED_REASON = 'provider support confirmed it never went through';
const SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: CONFIRMED_REF } as const;
const FAILED = { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: RECORDED_REASON } as const;

describe('settleFlaggedCharge: a human settles what reconcile could not (ADR 0017 decision 7)', () => {
  it('settles a flagged renewal as succeeded through the renewal cycle: the period advances, charge.succeeded', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingRenewal(tx, STUCK);

      expect(await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: SUCCEEDED }, SETTLED_AT)).toBe(
        SETTLE_FLAGGED.SETTLED,
      );

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.SUCCEEDED, providerChargeRef: CONFIRMED_REF }),
      ]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.CHARGE_SUCCEEDED]);
    });
  });

  it('settles a flagged renewal as failed: past_due, with the recorded reason on the charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingRenewal(tx, STUCK);

      await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: FAILED }, SETTLED_AT);

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.FAILED, failureReason: RECORDED_REASON }),
      ]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
        currentPeriodEnd: PERIOD_END,
        dunningStartedAt: SETTLED_AT,
      });
    });
  });

  it('settles a flagged charge #1 through the first-charge path', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingFirstCharge(tx, STUCK);

      await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: SUCCEEDED }, SETTLED_AT);

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: PERIOD_END,
      });
      const events = await eventsOf(tx, subscription.subscriptionId);
      expect(events.map(({ eventType }) => eventType)).toEqual([OUTBOUND_EVENT_TYPE.SUBSCRIPTION_ACTIVATED]);
    });
  });

  it('keeps the flag, as the record that a human settled this charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingRenewal(tx, STUCK);

      await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: SUCCEEDED }, SETTLED_AT);

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: FLAGGED_AT }),
      ]);
    });
  });
});

describe('settleFlaggedCharge: what it refuses (ADR 0017 decision 7)', () => {
  it('refuses a pending charge nobody flagged: reconcile still owns that one', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedPendingRenewal(tx);

      expect(await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: SUCCEEDED }, SETTLED_AT)).toBe(
        SETTLE_FLAGGED.NOT_SETTLEABLE,
      );

      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ status: CHARGE_STATUS.PENDING }),
      ]);
    });
  });

  it('refuses a late success: the charge is already failed, and the refund happens outside the system', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, charge } = await seedLostRenewal(tx, {
        reconcileFlag: RECONCILE_FLAG.LATE_SUCCESS,
        flaggedAt: FLAGGED_AT,
      });

      expect(await settleFlaggedCharge(tx, { chargeId: charge.chargeId, result: SUCCEEDED }, SETTLED_AT)).toBe(
        SETTLE_FLAGGED.NOT_SETTLEABLE,
      );

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.PAST_DUE,
      });
      expect(await eventsOf(tx, subscription.subscriptionId)).toEqual([]);
    });
  });

  it('answers not found for an unknown charge', async () => {
    await withRollback(testDb(), async (tx) => {
      const unknown = zChargeRead.shape.chargeId.parse(randomUUID());
      expect(await settleFlaggedCharge(tx, { chargeId: unknown, result: SUCCEEDED }, SETTLED_AT)).toBe(
        SETTLE_FLAGGED.NOT_FOUND,
      );
    });
  });
});
