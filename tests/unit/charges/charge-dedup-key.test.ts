import { describe, expect, it } from 'vitest';
import { chargeDedupKey } from '@/lib/charges/charge-dedup-key';

const SUBSCRIPTION_ID = '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f';
const PERIOD_END = new Date('2026-02-15T10:00:00.000Z');

describe('chargeDedupKey (Spec 1: subscriptionId:periodEnd:attempt)', () => {
  it('joins the three parts of the charge identity', () => {
    expect(chargeDedupKey(SUBSCRIPTION_ID, PERIOD_END, 0)).toBe(
      '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f:2026-02-15T10:00:00.000Z:0',
    );
  });

  it('differs per attempt, so a dunning retry is a new charge to the provider', () => {
    expect(chargeDedupKey(SUBSCRIPTION_ID, PERIOD_END, 1)).not.toBe(chargeDedupKey(SUBSCRIPTION_ID, PERIOD_END, 0));
  });

  it('is the same for the same attempt, so a replay is rejected by the provider', () => {
    expect(chargeDedupKey(SUBSCRIPTION_ID, new Date(PERIOD_END), 0)).toBe(
      chargeDedupKey(SUBSCRIPTION_ID, PERIOD_END, 0),
    );
  });
});
