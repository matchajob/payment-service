import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { insertCycleCharge } from '@tests/utils/cycle-charge-insert';
import { testDb, withRollback } from '@tests/utils/db';
import { insertOutboxEvent } from '@tests/utils/outbox-rows';
import { RENEWAL } from '@tests/utils/pending-charge-shapes';
import { seedRenewing, seedRenewings } from '@tests/utils/renewal-rows';
import { sdkFor } from '@tests/utils/sdk-client';
import { testApp } from '@tests/utils/test-app';

const PAGE_SIZE = 1;
const SUBSCRIPTION_COUNT = 2;
const FIRST_SEQUENCE = 1;

describe('SDK dashboard reads and redrive, run against the real app (dashboard slice 1)', () => {
  it('pages subscriptions, passing limit, startingAfter and status as the query', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, renewings } = await seedRenewings(tx, SUBSCRIPTION_COUNT);
      const sdk = sdkFor(testApp(tx), ctx.apiKey);
      const first = await sdk.subscriptions.list({ limit: PAGE_SIZE, status: SUBSCRIPTION_STATUS.ACTIVE });
      const last = first.data.at(-1)?.subscriptionId;
      const second = await sdk.subscriptions.list({ limit: PAGE_SIZE, startingAfter: last });
      expect(first.hasMore).toBe(true);
      expect(second.hasMore).toBe(false);
      expect([...first.data, ...second.data].map((s) => s.subscriptionId).toSorted()).toEqual(
        renewings.map((r) => r.subscription.subscriptionId).toSorted(),
      );
    });
  });

  it('lists failed charges', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      const failed = await insertCycleCharge(tx, renewing, RENEWAL, {
        status: CHARGE_STATUS.FAILED,
        failureReason: 'card declined',
      });
      const page = await sdkFor(testApp(tx), renewing.ctx.apiKey).charges.list({ status: CHARGE_STATUS.FAILED });
      expect(page.data.map((c) => c.chargeId)).toEqual([failed.chargeId]);
    });
  });

  it('lists dead events and redrives one', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx, subscription } = await seedRenewing(tx);
      await insertOutboxEvent(tx, subscription, FIRST_SEQUENCE, {
        deliveryStatus: DELIVERY_STATUS.DEAD,
        lastError: 'tenant endpoint answered 500',
      });
      const sdk = sdkFor(testApp(tx), ctx.apiKey);
      const dead = await sdk.events.list({ deliveryStatus: DELIVERY_STATUS.DEAD });
      const eventId = dead.data[0]?.eventId ?? '';
      const redriven = await sdk.events.redrive(eventId);
      expect(redriven).toMatchObject({ eventId, deliveryStatus: DELIVERY_STATUS.PENDING });
    });
  });
});
