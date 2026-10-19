import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import { DECLINED } from '@tests/utils/declined-charge-fixtures';
import { FAKE_CHARGE_TIMEOUT, fakePaymentProvider } from '@tests/utils/fake-payment-provider';
import { RENEWAL_CHARGE_REF, RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';

const REQUEST = {
  paymentMethodToken: 'token-1',
  amountMinor: 4900,
  currency: CURRENCY.ILS,
  dedupKey: 'sub-1:p1:0',
  chargeSerial: 1n,
};
const OTHER_KEY = { ...REQUEST, dedupKey: 'sub-1:p2:0', chargeSerial: 2n };
const BY_KEY = {
  dedupKey: REQUEST.dedupKey,
  providerChargeRef: null,
  paymentMethodToken: REQUEST.paymentMethodToken,
  chargeSerial: REQUEST.chargeSerial,
};

describe('fakePaymentProvider.charge: provider-side dedup (ADR 0008, M28 in code-review-1)', () => {
  it('answers a repeated dedup key with the first result and charges nothing more', async () => {
    const provider = fakePaymentProvider();
    provider.scriptCharge(RENEWAL_SUCCEEDED);

    expect(await provider.charge(REQUEST)).toEqual(RENEWAL_SUCCEEDED);
    expect(await provider.charge(REQUEST)).toEqual(RENEWAL_SUCCEEDED);

    expect(provider.calls.charge).toHaveLength(2);
    expect(provider.processedCharges()).toEqual([{ request: REQUEST, result: RENEWAL_SUCCEEDED }]);
  });

  it('charges a new dedup key as a new charge', async () => {
    const provider = fakePaymentProvider();
    provider.scriptCharge(RENEWAL_SUCCEEDED);
    provider.scriptCharge(DECLINED);

    await provider.charge(REQUEST);

    expect(await provider.charge(OTHER_KEY)).toEqual(DECLINED);
    expect(provider.processedCharges()).toHaveLength(2);
  });

  it('can time out after it charged: the caller sees an error, the money moved', async () => {
    const provider = fakePaymentProvider();
    provider.scriptChargeThenTimeOut(RENEWAL_SUCCEEDED);

    await expect(provider.charge(REQUEST)).rejects.toThrow(FAKE_CHARGE_TIMEOUT);

    expect(provider.processedCharges()).toEqual([{ request: REQUEST, result: RENEWAL_SUCCEEDED }]);
  });

  it('times out before charging when charges fail: nothing reaches the ledger', async () => {
    const provider = fakePaymentProvider();
    provider.failCharges();

    await expect(provider.charge(REQUEST)).rejects.toThrow(FAKE_CHARGE_TIMEOUT);

    expect(provider.processedCharges()).toEqual([]);
  });

  it.fails('fails the test that charged with nothing scripted, even when the caller swallowed the error', async () => {
    await fakePaymentProvider()
      .charge(REQUEST)
      .catch(() => undefined);
  });
});

describe('fakePaymentProvider.verifyCharge: answers from what it charged (M28 in code-review-1)', () => {
  it('reports a charge that timed out after charging as succeeded, with the amount it took', async () => {
    const provider = fakePaymentProvider();
    provider.scriptChargeThenTimeOut(RENEWAL_SUCCEEDED);
    await provider.charge(REQUEST).catch(() => undefined);

    expect(await provider.verifyCharge(BY_KEY)).toEqual({
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: RENEWAL_CHARGE_REF,
      amountMinor: REQUEST.amountMinor,
      currency: REQUEST.currency,
    });
  });

  it('reports a declined charge as failed with its reason', async () => {
    const provider = fakePaymentProvider();
    provider.scriptCharge(DECLINED);
    await provider.charge(REQUEST);

    expect(await provider.verifyCharge(BY_KEY)).toEqual({
      outcome: VERIFY_OUTCOME.FAILED,
      providerChargeRef: DECLINED.providerChargeRef,
      reason: DECLINED.reason,
    });
  });

  it('cannot find a dedup key it never charged', async () => {
    expect(await fakePaymentProvider().verifyCharge(BY_KEY)).toEqual({ outcome: VERIFY_OUTCOME.NOT_FOUND });
  });

  it('prefers a scripted answer, so a test can model a provider that disagrees with itself', async () => {
    const provider = fakePaymentProvider();
    provider.scriptCharge(RENEWAL_SUCCEEDED);
    await provider.charge(REQUEST);
    provider.scriptVerify({ outcome: VERIFY_OUTCOME.PENDING });

    expect(await provider.verifyCharge(BY_KEY)).toEqual({ outcome: VERIFY_OUTCOME.PENDING });
    expect(provider.calls.verifyCharge).toEqual([BY_KEY]);
  });
});
