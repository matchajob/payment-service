import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { RECONCILE_FLAG } from '@/lib/charges/reconcile-flag';
import type { Database } from '@/lib/db';
import { insertCharge, seedChargeOwner } from '@tests/utils/charge-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { GLOBEX } from '@tests/utils/tenant-fixtures';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const SUCCEEDED_HAS_REF = 'charges_succeeded_has_provider_ref';
const REASON_IFF_FAILED = 'charges_failure_reason_iff_failed';
const ONE_PER_ATTEMPT = 'charges_one_per_attempt';
const ONE_LIVE_PER_PERIOD = 'charges_one_live_per_period';
const SUBSCRIPTION_CONNECTION = 'charges_subscription_connection';
const PAYMENT_METHOD_CONNECTION = 'charges_payment_method_connection';
const FLAG_IFF_FLAGGED_AT = 'charges_reconcile_flag_iff_flagged_at';
const FLAGGED_AT = new Date('2026-02-22T10:00:00.000Z');
const DECLINED = 'card declined';
const CHARGE_1 = 'charge-1';
const CHARGE_2 = 'charge-2';
const CHARGE_3 = 'charge-3';
const NEXT_PERIOD_END = new Date('2026-03-15T10:00:00.000Z');

const { PENDING, SUCCEEDED, FAILED } = CHARGE_STATUS;

describe('charges table constraints', () => {
  describe('the outcome columns match the status', () => {
    it.each([
      { status: SUCCEEDED, providerChargeRef: CHARGE_1, failureReason: null },
      { status: FAILED, providerChargeRef: CHARGE_1, failureReason: DECLINED },
      { status: FAILED, providerChargeRef: null, failureReason: DECLINED },
      { status: PENDING, providerChargeRef: CHARGE_1, failureReason: null },
      { status: PENDING, providerChargeRef: null, failureReason: null },
    ])('accepts $status with ref $providerChargeRef and reason $failureReason', async (row) => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        expect(await violatedConstraint(tx, (db) => insertCharge(db, owner, row))).toBeUndefined();
      });
    });

    it('rejects a succeeded charge without the provider reference that reconcile verifies', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        const write = (db: Database) => insertCharge(db, owner, { status: SUCCEEDED, providerChargeRef: null });
        expect(await violatedConstraint(tx, write)).toBe(SUCCEEDED_HAS_REF);
      });
    });

    it.each([
      ['a failed charge without a reason (Spec 2 stores it)', { status: FAILED, failureReason: null }],
      ['a reason on a succeeded charge', { status: SUCCEEDED, failureReason: DECLINED }],
      ['a reason on a pending charge', { status: PENDING, failureReason: DECLINED }],
    ])('rejects %s', async (_, row) => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        expect(await violatedConstraint(tx, (db) => insertCharge(db, owner, row))).toBe(REASON_IFF_FAILED);
      });
    });
  });

  describe('double-charge tripwires (Spec 1 double-charge guards)', () => {
    it('records each (subscription, periodEnd, attempt) once, matching the provider dedup key', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        await insertCharge(tx, owner, { status: FAILED, failureReason: DECLINED });
        const replay = (db: Database) => insertCharge(db, owner, { status: FAILED, failureReason: DECLINED });
        expect(await violatedConstraint(tx, replay)).toBe(ONE_PER_ATTEMPT);
      });
    });

    it.each([
      [SUCCEEDED, PENDING],
      [PENDING, PENDING],
      [PENDING, SUCCEEDED],
      [SUCCEEDED, SUCCEEDED],
    ])(
      'blocks a second live charge for the period (%s then %s), so the provider is never called twice',
      async (first, second) => {
        await withRollback(testDb(), async (tx) => {
          const owner = await seedChargeOwner(tx);
          await insertCharge(tx, owner, { attempt: 0, status: first });
          const again = (db: Database) =>
            insertCharge(db, owner, { attempt: 1, status: second, providerChargeRef: CHARGE_2 });
          expect(await violatedConstraint(tx, again)).toBe(ONE_LIVE_PER_PERIOD);
        });
      },
    );

    it('allows failed attempts before the one that succeeds (dunning)', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        await insertCharge(tx, owner, { attempt: 0, status: FAILED, failureReason: DECLINED });
        await insertCharge(tx, owner, { attempt: 1, status: FAILED, failureReason: DECLINED });
        const rescue = (db: Database) => insertCharge(db, owner, { attempt: 2, providerChargeRef: CHARGE_3 });
        expect(await violatedConstraint(tx, rescue)).toBeUndefined();
      });
    });

    it('allows a success in each period', async () => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        await insertCharge(tx, owner);
        const nextPeriod = (db: Database) =>
          insertCharge(db, owner, { periodEnd: NEXT_PERIOD_END, providerChargeRef: CHARGE_2 });
        expect(await violatedConstraint(tx, nextPeriod)).toBeUndefined();
      });
    });
  });

  describe('the charge runs through the connection that captured the card (ADR 0010 amendment 1)', () => {
    it("rejects a charge on a connection other than its subscription's", async () => {
      await withRollback(testDb(), async (tx) => {
        const ours = await seedChargeOwner(tx);
        const theirs = await seedChargeOwner(tx, GLOBEX);
        const write = (db: Database) =>
          insertCharge(db, {
            ...ours,
            paymentMethodId: theirs.paymentMethodId,
            providerConnectionId: theirs.providerConnectionId,
          });
        expect(await violatedConstraint(tx, write)).toBe(SUBSCRIPTION_CONNECTION);
      });
    });

    it('rejects a charge whose card was captured on another connection', async () => {
      await withRollback(testDb(), async (tx) => {
        const ours = await seedChargeOwner(tx);
        const theirs = await seedChargeOwner(tx, GLOBEX);
        const write = (db: Database) => insertCharge(db, { ...ours, paymentMethodId: theirs.paymentMethodId });
        expect(await violatedConstraint(tx, write)).toBe(PAYMENT_METHOD_CONNECTION);
      });
    });
  });

  describe('a reconcile flag carries the time it was raised (ADR 0017)', () => {
    it.each([
      { reconcileFlag: null, flaggedAt: null },
      { reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: FLAGGED_AT },
    ])('accepts flag $reconcileFlag at $flaggedAt', async (row) => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        const pending = { status: PENDING, providerChargeRef: null, ...row };
        expect(await violatedConstraint(tx, (db) => insertCharge(db, owner, pending))).toBeUndefined();
      });
    });

    it.each([
      { reconcileFlag: RECONCILE_FLAG.STUCK_PENDING, flaggedAt: null },
      { reconcileFlag: null, flaggedAt: FLAGGED_AT },
    ])('rejects flag $reconcileFlag at $flaggedAt', async (row) => {
      await withRollback(testDb(), async (tx) => {
        const owner = await seedChargeOwner(tx);
        const pending = { status: PENDING, providerChargeRef: null, ...row };
        expect(await violatedConstraint(tx, (db) => insertCharge(db, owner, pending))).toBe(FLAG_IFF_FLAGGED_AT);
      });
    });
  });
});
