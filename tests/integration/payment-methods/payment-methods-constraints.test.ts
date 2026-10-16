import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { testDb, withRollback } from '@tests/utils/db';
import { seedConnection } from '@tests/utils/connection-rows';
import { insertPaymentMethod, seedSubscriptionOwner } from '@tests/utils/payment-method-rows';
import { violatedConstraint } from '@tests/utils/violated-constraint';

const ONE_PER_CAPTURE = 'payment_methods_one_per_capture';
const ONE_CURRENT = 'payment_methods_one_current_per_subscription';
const SUBSCRIPTION_CONNECTION = 'payment_methods_subscription_connection';
const SESSION_1 = 'session-1';
const SESSION_2 = 'session-2';
const SESSION_3 = 'session-3';
const REPLACED_AT = new Date('2026-01-20T10:00:00.000Z');

describe('payment_methods', () => {
  it('saves at most one card per capture, so a replayed webhook cannot save it twice', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      await insertPaymentMethod(tx, owner, SESSION_1, REPLACED_AT);
      const replay = (db: Database) => insertPaymentMethod(db, owner, SESSION_1);
      expect(await violatedConstraint(tx, replay)).toBe(ONE_PER_CAPTURE);
    });
  });

  it('allows only one current card per subscription', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      await insertPaymentMethod(tx, owner, SESSION_1);
      const second = (db: Database) => insertPaymentMethod(db, owner, SESSION_2);
      expect(await violatedConstraint(tx, second)).toBe(ONE_CURRENT);
    });
  });

  it('keeps replaced cards as history beside the current one (row 13)', async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      await insertPaymentMethod(tx, owner, SESSION_1, REPLACED_AT);
      await insertPaymentMethod(tx, owner, SESSION_2, REPLACED_AT);
      const current = (db: Database) => insertPaymentMethod(db, owner, SESSION_3);
      expect(await violatedConstraint(tx, current)).toBeUndefined();
    });
  });

  it("rejects a card saved on a connection other than its subscription's (ADR 0010 amendment 1)", async () => {
    await withRollback(testDb(), async (tx) => {
      const owner = await seedSubscriptionOwner(tx);
      const { providerConnectionId } = await seedConnection(tx);
      const write = (db: Database) => insertPaymentMethod(db, { ...owner, providerConnectionId }, SESSION_1);
      expect(await violatedConstraint(tx, write)).toBe(SUBSCRIPTION_CONNECTION);
    });
  });
});
