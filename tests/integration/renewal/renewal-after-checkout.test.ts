import { describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '@/api/http-status';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { seedBillingContext } from '@tests/utils/billing-context';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { chargesOf, subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_AFTER_NEXT_END, PERIOD_END } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { testApp } from '@tests/utils/test-app';

const SESSION = 'session-1';
const FIRST_CHARGE_SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: 'charge-1' } as const;

const subscribed = async (tx: Database) => {
  const ctx = await seedBillingContext(tx);
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(ctx.providerConnectionId);
  const app = testApp(tx, { providerFor: providers.providerFor });
  const subscriptionId = await startTestCheckout(app, ctx);
  provider.scriptCharge(FIRST_CHARGE_SUCCEEDED);
  const res = await app.request(
    webhookPath(ctx.providerConnectionId),
    postWebhook(fakeCheckoutCompletedBody(subscriptionId, SESSION)),
  );
  if (res.status !== HTTP_STATUS.OK) throw new Error(`checkout did not complete: ${res.status}`);
  return { subscriptionId, provider, renew: renewWith(tx, providers.providerFor) };
};

describe('renewal after a real checkout (S1 r5, H1 in code-review-1)', () => {
  it('charges month 2 when month 1 ends: charge #1 does not count as the renewal', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscriptionId, provider, renew } = await subscribed(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect(await renew(PERIOD_END)).toEqual({ processed: 1, failed: 0 });

      expect(provider.calls.charge.map(({ dedupKey }) => dedupKey)).toEqual([
        `${subscriptionId}:${PERIOD_END.toISOString()}:0`,
        `${subscriptionId}:${NEXT_PERIOD_END.toISOString()}:0`,
      ]);
    });
  });

  it('keys each charge on the end of the period it pays for and marks what it was', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscriptionId, provider, renew } = await subscribed(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      await renew(PERIOD_END);

      expect(await chargesOf(tx, subscriptionId)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: CHARGE_KIND.FIRST, periodEnd: PERIOD_END, status: CHARGE_STATUS.SUCCEEDED }),
          expect.objectContaining({
            kind: CHARGE_KIND.RENEWAL,
            periodEnd: NEXT_PERIOD_END,
            status: CHARGE_STATUS.SUCCEEDED,
          }),
        ]),
      );
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
    });
  });

  it('keeps renewing: month 3 is charged when month 2 ends', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscriptionId, provider, renew } = await subscribed(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(PERIOD_END);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect(await renew(NEXT_PERIOD_END)).toEqual({ processed: 1, failed: 0 });

      expect(provider.calls.charge).toHaveLength(3);
      expect(await subscriptionRow(tx, subscriptionId)).toMatchObject({ currentPeriodEnd: PERIOD_AFTER_NEXT_END });
    });
  });

  it('does not charge month 2 twice when the cron fires again the same day', async () => {
    await withRollback(testDb(), async (tx) => {
      const { provider, renew } = await subscribed(tx);
      provider.scriptCharge(RENEWAL_SUCCEEDED);
      await renew(PERIOD_END);

      expect(await renew(PERIOD_END)).toEqual({ processed: 0, failed: 0 });

      expect(provider.calls.charge).toHaveLength(2);
    });
  });
});
