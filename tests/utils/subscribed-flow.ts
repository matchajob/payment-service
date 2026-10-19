import { HTTP_STATUS } from '@/api/http-status';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import type { Database } from '@/lib/db';
import { createPlan, type CreatePlanInput } from '@/lib/plans/create-plan';
import { seedBillingContext } from '@tests/utils/billing-context';
import { startTestCheckout } from '@tests/utils/checkout-flow';
import { dunWith } from '@tests/utils/dunning-run';
import { fakeClock } from '@tests/utils/fake-clock';
import { fakeCheckoutCompletedBody } from '@tests/utils/fake-payment-provider';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { renewWith } from '@tests/utils/renewal-run';
import { TEST_NOW, testApp } from '@tests/utils/test-app';

type PlanFixture = Omit<CreatePlanInput, 'tenantId'>;
type FlowOptions = { activatedAt?: Date; plan?: PlanFixture };

export const FIRST_CHARGE_SUCCEEDED = { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: 'charge-1' } as const;

export const checkoutStarted = async (db: Database, { activatedAt = TEST_NOW, plan }: FlowOptions = {}) => {
  const seeded = await seedBillingContext(db);
  const ctx =
    plan === undefined ? seeded : { ...seeded, plan: await createPlan(db, { tenantId: seeded.tenantId, ...plan }) };
  const providers = fakeProviderFactory();
  const provider = providers.providerOf(ctx.providerConnectionId);
  const clock = fakeClock(activatedAt);
  const app = testApp(db, { providerFor: providers.providerFor, clock });
  const subscriptionId = await startTestCheckout(app, ctx);
  const complete = () =>
    app.request(
      webhookPath(ctx.providerConnectionId),
      postWebhook(fakeCheckoutCompletedBody(subscriptionId, provider.lastCheckoutSession().providerSessionRef)),
    );
  return {
    ctx,
    providers,
    provider,
    clock,
    app,
    subscriptionId,
    complete,
    renew: renewWith(db, providers.providerFor),
    dun: dunWith(db, providers.providerFor),
    reconcile: reconcileWith(db, providers.providerFor),
  };
};

export const subscribedThroughCheckout = async (db: Database, options: FlowOptions = {}) => {
  const flow = await checkoutStarted(db, options);
  flow.provider.scriptCharge(FIRST_CHARGE_SUCCEEDED);
  const res = await flow.complete();
  if (res.status !== HTTP_STATUS.OK) throw new Error(`checkout did not complete: ${res.status}`);
  return flow;
};

export type SubscribedFlow = Awaited<ReturnType<typeof subscribedThroughCheckout>>;
