import { describe, expect, it } from 'vitest';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { HOUSEKEEPING_BATCH_LIMIT } from '@/lib/housekeeping/housekeeping-batch-limit';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory, type FakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { housekeepWith } from '@tests/utils/housekeeping-run';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { insertSubscription, seedSubscriptionParents } from '@tests/utils/subscription-rows';
import { ACME, GLOBEX, type TenantFixture } from '@tests/utils/tenant-fixtures';

const CREATED_AT = new Date('2026-01-15T10:00:00.000Z');
const DEFAULT_TTL_HOURS = 12;
const EXPIRED = after(CREATED_AT, DEFAULT_TTL_HOURS * HOUR_MS);
const NEXT_RUN = after(EXPIRED, HOUR_MS);
const SESSION_REF = 'session-1';
const CHARGE_REF = 'charge-1';
const ONE_PER_RUN = 1;
const SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: CHARGE_REF } as const;

const seedCheckout = async (
  tx: Database,
  providers: FakeProviderFactory,
  createdAt: Date = CREATED_AT,
  tenant: TenantFixture = ACME,
) => {
  const parents = await seedSubscriptionParents(tx, tenant);
  const [subscription] = await insertSubscription(tx, parents, {
    createdAt,
    checkoutSessionRef: SESSION_REF,
  }).returning();
  if (subscription === undefined) throw new Error('subscription insert returned no row');
  return { subscription, provider: providers.providerOf(parents.providerConnectionId) };
};

describe('runHousekeeping: ask the provider before expiring a checkout (code-review-1 M1)', () => {
  it('completes a checkout the provider confirms was saved, instead of canceling a customer who finished paying', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { subscription, provider } = await seedCheckout(tx, providers);
      provider.scriptCharge(SUCCEEDED);

      expect(await housekeepWith(tx, HOUSEKEEPING_BATCH_LIMIT, providers.providerFor)(EXPIRED)).toEqual({
        processed: 1,
        failed: 0,
      });

      expect(provider.calls.verifyCheckout).toEqual([SESSION_REF]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
      });
      expect(await chargesOf(tx, subscription.subscriptionId)).toEqual([
        expect.objectContaining({ kind: CHARGE_KIND.FIRST, status: CHARGE_STATUS.SUCCEEDED }),
      ]);
    });
  });

  it('cancels it as expired when the provider confirms nothing was saved', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const { subscription, provider } = await seedCheckout(tx, providers);
      provider.scriptCheckoutNotCompleted();

      expect(await housekeepWith(tx, HOUSEKEEPING_BATCH_LIMIT, providers.providerFor)(EXPIRED)).toEqual({
        processed: 1,
        failed: 0,
      });

      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.CHECKOUT_EXPIRED,
      });
      expect(provider.calls.charge).toEqual([]);
    });
  });

  it('keeps the checkout when the provider cannot be asked, and moves it behind the rest so it starves nobody', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const unreachable = await seedCheckout(tx, providers);
      const waiting = await seedCheckout(tx, providers, after(CREATED_AT, HOUR_MS), GLOBEX);
      unreachable.provider.failCheckoutVerifies();
      waiting.provider.scriptCheckoutNotCompleted();
      const housekeep = housekeepWith(tx, ONE_PER_RUN, providers.providerFor);

      expect(await housekeep(EXPIRED)).toEqual({ processed: 0, failed: 1 });
      expect(await subscriptionRow(tx, unreachable.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.INCOMPLETE,
        cycleDeferredAt: EXPIRED,
      });

      expect(await housekeep(NEXT_RUN)).toEqual({ processed: 1, failed: 0 });
      expect(await subscriptionRow(tx, waiting.subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
      });
    });
  });
});
