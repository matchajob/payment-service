import { describe, expect, it } from 'vitest';
import { createCustomer, CREATE_CUSTOMER_OUTCOME } from '@/lib/customers/create-customer';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { insertSubscription, PERIOD_END, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const CANCEL_FLAG_ONLY_ON_ACTIVE = 'subscriptions_cancel_flag_only_on_active';
const INCOMPLETE_HAS_NO_PERIOD = 'subscriptions_incomplete_has_no_period';
const LIVE_HAS_PERIOD = 'subscriptions_live_has_period';
const ONE_LIVE_PER_CUSTOMER = 'subscriptions_one_live_per_customer';
const OTHER_EXTERNAL_REF = 'user-43';
const DUNNING_BASE_WITHIN_ATTEMPTS = 'subscriptions_dunning_base_within_attempts';
const RESTARTED_AT_ATTEMPT = 3;

const { INCOMPLETE, ACTIVE, PAST_DUE, CANCELED } = SUBSCRIPTION_STATUS;

describe('subscriptions table constraints', () => {
  describe('cancelAtPeriodEnd is only allowed on active (ADR 0005)', () => {
    it('accepts the flag on an active subscription', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) =>
          insertSubscription(db, parents, { status: ACTIVE, currentPeriodEnd: PERIOD_END, cancelAtPeriodEnd: true });
        expect(await violatedConstraint(tx, write)).toBeUndefined();
      });
    });

    it.each([
      { status: INCOMPLETE, currentPeriodEnd: null },
      { status: PAST_DUE, currentPeriodEnd: PERIOD_END },
      { status: CANCELED, currentPeriodEnd: PERIOD_END },
    ])('rejects the flag on $status', async (row) => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) => insertSubscription(db, parents, { ...row, cancelAtPeriodEnd: true });
        expect(await violatedConstraint(tx, write)).toBe(CANCEL_FLAG_ONLY_ON_ACTIVE);
      });
    });
  });

  describe('currentPeriodEnd follows the status', () => {
    it.each([
      { status: INCOMPLETE, currentPeriodEnd: null },
      { status: ACTIVE, currentPeriodEnd: PERIOD_END },
      { status: PAST_DUE, currentPeriodEnd: PERIOD_END },
      { status: CANCELED, currentPeriodEnd: null },
      { status: CANCELED, currentPeriodEnd: PERIOD_END },
    ])('accepts $status with period end $currentPeriodEnd', async (row) => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        expect(await violatedConstraint(tx, (db) => insertSubscription(db, parents, row))).toBeUndefined();
      });
    });

    it('rejects an incomplete subscription that has a period end', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) =>
          insertSubscription(db, parents, { status: INCOMPLETE, currentPeriodEnd: PERIOD_END });
        expect(await violatedConstraint(tx, write)).toBe(INCOMPLETE_HAS_NO_PERIOD);
      });
    });

    it.each([ACTIVE, PAST_DUE])('rejects a %s subscription without a period end', async (status) => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) => insertSubscription(db, parents, { status, currentPeriodEnd: null });
        expect(await violatedConstraint(tx, write)).toBe(LIVE_HAS_PERIOD);
      });
    });
  });

  describe('one live subscription per customer', () => {
    it.each([
      [ACTIVE, ACTIVE],
      [ACTIVE, PAST_DUE],
      [PAST_DUE, PAST_DUE],
    ])('rejects a second live row: %s then %s', async (first, second) => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        await insertSubscription(tx, parents, { status: first, currentPeriodEnd: PERIOD_END });
        const write = (db: Database) =>
          insertSubscription(db, parents, { status: second, currentPeriodEnd: PERIOD_END });
        expect(await violatedConstraint(tx, write)).toBe(ONE_LIVE_PER_CUSTOMER);
      });
    });

    it('allows any number of incomplete and canceled rows beside the live one', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        await insertSubscription(tx, parents, { status: ACTIVE, currentPeriodEnd: PERIOD_END });
        await insertSubscription(tx, parents, { status: INCOMPLETE });
        await insertSubscription(tx, parents, { status: INCOMPLETE });
        await insertSubscription(tx, parents, { status: CANCELED });
        await insertSubscription(tx, parents, { status: CANCELED, currentPeriodEnd: PERIOD_END });
      });
    });

    it('lets two different customers each have a live subscription', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const other = await createCustomer(tx, parents.tenantId, OTHER_EXTERNAL_REF);
        if (other.outcome !== CREATE_CUSTOMER_OUTCOME.CREATED) throw new Error('second customer already existed');
        await insertSubscription(tx, parents, { status: ACTIVE, currentPeriodEnd: PERIOD_END });
        const write = (db: Database) =>
          insertSubscription(
            db,
            { ...parents, customerId: other.customer.customerId },
            { status: ACTIVE, currentPeriodEnd: PERIOD_END },
          );
        expect(await violatedConstraint(tx, write)).toBeUndefined();
      });
    });
  });
});

describe('dunning and cancel columns follow the status (ADR 0014)', () => {
  const RETRY_IFF_PAST_DUE = 'subscriptions_retry_iff_past_due';
  const DUNNING_CLOCK_WITH_RETRY = 'subscriptions_dunning_clock_with_retry';
  const CANCEL_REASON_IFF_CANCELED = 'subscriptions_cancel_reason_iff_canceled';
  const RETRY_AT = new Date('2026-02-16T10:00:00.000Z');

  it.each([
    ['a past_due row without a next retry', { status: PAST_DUE, nextRetryAt: null, dunningStartedAt: null }],
    ['an active row with a next retry', { status: ACTIVE, nextRetryAt: RETRY_AT, dunningStartedAt: PERIOD_END }],
  ])('rejects %s', async (_, row) => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      const write = (db: Database) => insertSubscription(db, parents, { ...row, currentPeriodEnd: PERIOD_END });
      expect(await violatedConstraint(tx, write)).toBe(RETRY_IFF_PAST_DUE);
    });
  });

  it('rejects a next retry without the moment dunning started', async () => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      const write = (db: Database) =>
        insertSubscription(db, parents, { status: PAST_DUE, currentPeriodEnd: PERIOD_END, dunningStartedAt: null });
      expect(await violatedConstraint(tx, write)).toBe(DUNNING_CLOCK_WITH_RETRY);
    });
  });

  it.each([
    ['a canceled row without a reason', { status: CANCELED, cancelReason: null }],
    ['an active row with a reason', { status: ACTIVE, cancelReason: CANCEL_REASON.PAYMENT_FAILURE }],
  ])('rejects %s', async (_, row) => {
    await withRollback(testDb(), async (tx) => {
      const parents = await seedSubscriptionParents(tx);
      const write = (db: Database) => insertSubscription(db, parents, { ...row, currentPeriodEnd: PERIOD_END });
      expect(await violatedConstraint(tx, write)).toBe(CANCEL_REASON_IFF_CANCELED);
    });
  });

  describe('the dunning base never passes the attempt count (ADR 0018 decision 2)', () => {
    it('accepts a base equal to the attempt, as a restart leaves it', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) =>
          insertSubscription(db, parents, {
            status: PAST_DUE,
            currentPeriodEnd: PERIOD_END,
            dunningAttempt: RESTARTED_AT_ATTEMPT,
            dunningAttemptBase: RESTARTED_AT_ATTEMPT,
          });
        expect(await violatedConstraint(tx, write)).toBeUndefined();
      });
    });

    it('rejects a base past the attempt', async () => {
      await withRollback(testDb(), async (tx) => {
        const parents = await seedSubscriptionParents(tx);
        const write = (db: Database) =>
          insertSubscription(db, parents, {
            status: PAST_DUE,
            currentPeriodEnd: PERIOD_END,
            dunningAttempt: RESTARTED_AT_ATTEMPT - 1,
            dunningAttemptBase: RESTARTED_AT_ATTEMPT,
          });
        expect(await violatedConstraint(tx, write)).toBe(DUNNING_BASE_WITHIN_ATTEMPTS);
      });
    });
  });
});
