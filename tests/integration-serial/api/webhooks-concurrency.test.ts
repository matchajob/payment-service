import { afterAll, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '@/api/http-status';
import { chargesTable } from '@/lib/charges/schema';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { seedBillingContext } from '@tests/utils/billing-context';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { testDb } from '@tests/utils/db';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { FIRST_CHARGE_SUCCEEDED } from '@tests/utils/subscribed-flow';
import { testApp } from '@tests/utils/test-app';
import { truncateModeDb } from '@tests/utils/truncate-mode';

describe('two identical checkout webhooks at once on separate instances (Spec 4 rule 1, M5 in code-review-1)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('charges once, writes one charge and one event, and records the webhook once', async () => {
    const ctx = await seedBillingContext(db);
    const providers = fakeProviderFactory();
    const provider = providers.providerOf(ctx.providerConnectionId);
    const one = testApp(db, { providerFor: providers.providerFor });
    const two = testApp(secondInstance, { providerFor: providers.providerFor });
    const subscriptionId = await startTestCheckout(one, ctx);
    const body = fakeCheckoutCompletedBody(subscriptionId, provider.lastCheckoutSession().providerSessionRef);
    provider.scriptCharge(FIRST_CHARGE_SUCCEEDED);

    const responses = await Promise.all(
      [one, two].map((app) => app.request(webhookPath(ctx.providerConnectionId), postWebhook(body))),
    );

    expect(provider.calls.charge).toHaveLength(1);
    expect(await db.$count(chargesTable)).toBe(1);
    expect(await db.$count(outboxEventsTable)).toBe(1);
    expect(await db.$count(webhookEventsTable)).toBe(1);
    expect(responses.map(({ status }) => status)).toEqual([HTTP_STATUS.OK, HTTP_STATUS.OK]);
  });
});
