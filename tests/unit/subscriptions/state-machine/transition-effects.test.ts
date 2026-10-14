import { describe, expect, it } from 'vitest';
import { transition } from '@/lib/subscriptions/state-machine/transition';
import { active, flagged, incomplete } from '@tests/unit/subscriptions/state-machine/fixtures/states';

const ALLOWED = { resumeAllowed: true };
const FORBIDDEN = { resumeAllowed: false };

describe('transition effects', () => {
  it('r2 records charge #1, stores the payment method, starts period 1, and emits activated', () => {
    expect(transition(incomplete, 'checkout_completed', ALLOWED)).toMatchObject({
      effects: ['record_charge', 'store_payment_method', 'start_period'],
      emits: ['subscription.activated'],
    });
  });

  it('asks the caller to charge when an unflagged row is due', () => {
    expect(transition(active, 'renewal_due', ALLOWED)).toMatchObject({ effects: ['charge_renewal'], emits: [] });
  });

  it('r7 cancels a flagged row at renewal without charging', () => {
    expect(transition(flagged, 'renewal_due', ALLOWED)).toMatchObject({
      effects: [],
      emits: ['subscription.canceled'],
    });
  });

  it('r6 starts dunning and emits charge.failed then subscription.past_due', () => {
    expect(transition(active, 'renewal_failed', ALLOWED)).toMatchObject({
      effects: ['record_charge', 'start_dunning'],
      emits: ['charge.failed', 'subscription.past_due'],
    });
  });

  it('r3 cancels an expired checkout silently', () => {
    expect(transition(incomplete, 'checkout_expired', ALLOWED)).toMatchObject({ effects: [], emits: [] });
  });

  it('r9 rejects resume when tenant policy forbids it', () => {
    expect(transition(flagged, 'resume', FORBIDDEN).kind).toBe('rejected');
  });
});
