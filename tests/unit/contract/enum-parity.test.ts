import { describe, expect, it } from 'vitest';
import { createSubscriptionResponseSchema } from '@/contract/create-subscription-response';
import { publicPlanSchema } from '@/contract/public-plan';
import { outboundEventSchema } from '@/contract/outbound-event';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
import { CURRENCY } from '@/lib/money/currency';
import { BILLING_INTERVAL } from '@/lib/subscriptions/billing-interval';
import { OUTBOUND_EVENT_TYPE } from '@/lib/subscriptions/state-machine/outbound-event-types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';

const sorted = (values: readonly string[]) => [...values].sort();

describe('contract enums match the server enums', () => {
  it('lists exactly the currencies the server stores', () => {
    expect(sorted(publicPlanSchema.shape.currency.options)).toEqual(sorted(Object.values(CURRENCY)));
  });

  it('lists exactly the billing intervals the server stores', () => {
    expect(sorted(publicPlanSchema.shape.interval.options)).toEqual(sorted(Object.values(BILLING_INTERVAL)));
  });

  it('lists exactly the subscription statuses the server stores', () => {
    expect(sorted(createSubscriptionResponseSchema.shape.data.shape.status.options)).toEqual(
      sorted(Object.values(SUBSCRIPTION_STATUS)),
    );
  });

  it('snapshot statuses match the server statuses', () => {
    expect(sorted(subscriptionSnapshotSchema.shape.status.options)).toEqual(sorted(Object.values(SUBSCRIPTION_STATUS)));
  });

  it('lists exactly the event types the outbox stores', () => {
    expect(sorted(outboundEventSchema.shape.type.options)).toEqual(sorted(Object.values(OUTBOUND_EVENT_TYPE)));
  });
});
