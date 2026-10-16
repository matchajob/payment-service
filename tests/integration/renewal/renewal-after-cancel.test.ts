import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { cancelPath, postNoBody, resumePath } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';

const setup = async (tx: Database) => {
  const providers = fakeProviderFactory();
  const { ctx, subscription } = await seedRenewing(tx);
  const provider = providers.providerOf(ctx.providerConnectionId);
  provider.scriptCharge(RENEWAL_SUCCEEDED);
  const app = testApp(tx);
  const call = (path: string) => app.request(path, postNoBody(ctx.apiKey));
  return { subscription, provider, call, renew: renewWith(tx, providers.providerFor) };
};

describe('cancel and resume through the API, then the renewal run (S1 r7, r8, r9)', () => {
  it('cancels at the period end with no charge after the tenant cancelled', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, call, renew } = await setup(tx);
      await call(cancelPath(subscription.subscriptionId));
      await renew(PERIOD_END);
      expect(provider.calls.charge).toEqual([]);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.CANCELED,
        cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
      });
    });
  });

  it('renews normally after the tenant cancelled and then resumed', async () => {
    await withRollback(testDb(), async (tx) => {
      const { subscription, provider, call, renew } = await setup(tx);
      await call(cancelPath(subscription.subscriptionId));
      await call(resumePath(subscription.subscriptionId));
      await renew(PERIOD_END);
      expect(provider.calls.charge).toHaveLength(1);
      expect(await subscriptionRow(tx, subscription.subscriptionId)).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        currentPeriodEnd: NEXT_PERIOD_END,
      });
    });
  });
});
