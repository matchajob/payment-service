import { describe, expect, it } from 'vitest';
import { readSettleChargeArgs } from '@/cli/settle-charge-args';
import { SETTLE_COMMAND } from '@/cli/settle-command';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';

const CHARGE_ID = '1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b';
const PROVIDER_REF = 'grow-tx-123';
const REASON = 'refunded by hand, never charged';
const RESOLUTION = 'refunded at the provider on 2026-11-04';
const FLAG = { CHARGE: '--charge', SUCCEEDED: '--succeeded', FAILED: '--failed', RESOLVE: '--resolve' } as const;

describe('readSettleChargeArgs (ADR 0017 decision 7)', () => {
  it('reads a charge settled as succeeded, with the provider reference a human confirmed', () => {
    expect(readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, FLAG.SUCCEEDED, PROVIDER_REF])).toEqual({
      kind: SETTLE_COMMAND.SETTLE,
      chargeId: CHARGE_ID,
      result: { outcome: CHARGE_STATUS.SUCCEEDED, providerChargeRef: PROVIDER_REF },
    });
  });

  it('reads a charge settled as failed, with the reason a human recorded', () => {
    expect(readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, FLAG.FAILED, REASON])).toEqual({
      kind: SETTLE_COMMAND.SETTLE,
      chargeId: CHARGE_ID,
      result: { outcome: CHARGE_STATUS.FAILED, providerChargeRef: undefined, reason: REASON },
    });
  });

  it('reads a flag resolved by hand, with the reason a human recorded (code-review-1 M9)', () => {
    expect(readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, FLAG.RESOLVE, RESOLUTION])).toEqual({
      kind: SETTLE_COMMAND.RESOLVE,
      chargeId: CHARGE_ID,
      resolution: RESOLUTION,
    });
  });

  it.each([
    ['a settle as succeeded', FLAG.SUCCEEDED, PROVIDER_REF],
    ['a settle as failed', FLAG.FAILED, REASON],
  ])('refuses a resolve together with %s', (_, flag, detail) => {
    expect(() => readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, FLAG.RESOLVE, RESOLUTION, flag, detail])).toThrow();
  });

  it('refuses no outcome, so a bare run settles nothing', () => {
    expect(() => readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID])).toThrow();
  });

  it('refuses both outcomes at once', () => {
    expect(() =>
      readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, FLAG.SUCCEEDED, PROVIDER_REF, FLAG.FAILED, REASON]),
    ).toThrow();
  });

  it('refuses a missing charge', () => {
    expect(() => readSettleChargeArgs([FLAG.SUCCEEDED, PROVIDER_REF])).toThrow();
  });

  it('refuses a charge id that is not a uuid', () => {
    expect(() => readSettleChargeArgs([FLAG.CHARGE, 'not-a-uuid', FLAG.SUCCEEDED, PROVIDER_REF])).toThrow();
  });

  it.each([
    ['an empty provider reference', FLAG.SUCCEEDED],
    ['an empty reason', FLAG.FAILED],
    ['an empty resolution', FLAG.RESOLVE],
  ])('refuses %s', (_, flag) => {
    expect(() => readSettleChargeArgs([FLAG.CHARGE, CHARGE_ID, flag, ''])).toThrow();
  });
});
