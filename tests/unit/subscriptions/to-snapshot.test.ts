import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { subscriptionSnapshotSchema } from '@/contract/subscription-snapshot';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { toSnapshot } from '@/lib/subscriptions/to-snapshot';

const EXTERNAL_REF = 'user-42';
const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');

const subscription = (overrides: Record<string, unknown> = {}) =>
  zSubscriptionRead.parse({
    subscriptionId: randomUUID(),
    tenantId: randomUUID(),
    customerId: randomUUID(),
    planId: randomUUID(),
    providerConnectionId: randomUUID(),
    status: SUBSCRIPTION_STATUS.ACTIVE,
    scheduleOwner: SCHEDULE_OWNER.SELF,
    checkoutSessionRef: 'session-1',
    currentPeriodEnd: PERIOD_END,
    anchorDay: 15,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    dunningAttempt: 0,
    dunningStartedAt: null,
    nextRetryAt: null,
    cycleDeferredAt: null,
    cancelReason: null,
    sequence: 0,
    createdAt: PERIOD_END,
    ...overrides,
  });

describe('toSnapshot (Spec 5 rule 3, D12)', () => {
  it('carries everything a receiver needs without calling back', () => {
    const row = subscription();
    expect(toSnapshot(row, { externalRef: EXTERNAL_REF }, { graceEntitlement: true })).toEqual({
      subscriptionId: row.subscriptionId,
      customerId: row.customerId,
      customerExternalRef: EXTERNAL_REF,
      planId: row.planId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      entitled: true,
      currentPeriodEnd: PERIOD_END.toISOString(),
      cancelAtPeriodEnd: false,
      cancelReason: null,
      canceledAt: null,
    });
  });

  it('tells the receiver why and when a subscription was canceled (S1 r11, ADR 0014, slice 9 D1)', () => {
    const canceled = subscription({
      status: SUBSCRIPTION_STATUS.CANCELED,
      canceledAt: PERIOD_END,
      cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
    });
    expect(toSnapshot(canceled, { externalRef: EXTERNAL_REF }, { graceEntitlement: true })).toMatchObject({
      cancelReason: CANCEL_REASON.PAYMENT_FAILURE,
      canceledAt: PERIOD_END.toISOString(),
    });
  });

  it('computes entitlement from the tenant grace policy, never leaving it to the receiver', () => {
    const pastDue = subscription({ status: SUBSCRIPTION_STATUS.PAST_DUE });
    expect(toSnapshot(pastDue, { externalRef: EXTERNAL_REF }, { graceEntitlement: false }).entitled).toBe(false);
  });

  it('gives a null period end as null', () => {
    const fresh = subscription({ status: SUBSCRIPTION_STATUS.CANCELED, currentPeriodEnd: null });
    expect(toSnapshot(fresh, { externalRef: EXTERNAL_REF }, { graceEntitlement: true }).currentPeriodEnd).toBeNull();
  });

  it('always produces a body the published contract accepts', () => {
    const snapshot = toSnapshot(subscription(), { externalRef: EXTERNAL_REF }, { graceEntitlement: true });
    expect(subscriptionSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });
});
