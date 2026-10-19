import { describe, expect, it } from 'vitest';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { CURRENCY } from '@/lib/money/currency';
import type { ChargeRequest } from '@/lib/payments/provider';
import { PAYER_FULL_NAME, PAYER_PHONE, SAVED_CARD_TOKEN, transactionInfoReply } from '@tests/utils/grow-built-replies';
import { growUnderTest, savedCardToken } from '@tests/utils/grow-provider-under-test';
import {
  BLOCK_PAGE,
  RECORDED_BAD_TOKEN,
  RECORDED_BAD_TOKEN_MESSAGE,
  RECORDED_STOLEN_CARD,
  RECORDED_STOLEN_CARD_MESSAGE,
  RECORDED_TOKEN_CHARGE_PAID,
} from '@tests/utils/grow-recorded-replies';
import { GROW_USER_ID } from '@tests/utils/provider-credentials-fixtures';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';

const CHARGE_SERIAL = 41n;
const LARGEST_GROW_IDENTIFIER = 4294967295n;
const REGULAR_PAYMENT_TYPE = '2';
const SINGLE_PAYMENT = '1';
const DEDUP_KEY = 'c1a7e3f0-8b2d-4e5f-9a6b-7c8d9e0f1a2b:2026-02-15T10:00:00.000Z:0';
const NOT_PAID_STATUS_CODE = '0';
const PLAN_MINOR = 4900;

const amounts = [
  { amountMinor: PLAN_MINOR, sum: '49.00' },
  { amountMinor: 4950, sum: '49.50' },
  { amountMinor: 5, sum: '0.05' },
  { amountMinor: 123456, sum: '1234.56' },
];

const chargeOf = (paymentMethodToken: string, overrides: Partial<ChargeRequest> = {}): ChargeRequest => ({
  paymentMethodToken,
  amountMinor: PLAN_MINOR,
  currency: CURRENCY.ILS,
  dedupKey: DEDUP_KEY,
  chargeSerial: CHARGE_SERIAL,
  ...overrides,
});

const ready = async () => {
  const under = growUnderTest();
  return { ...under, token: await savedCardToken(under) };
};

describe('growProvider.charge: the request (grow skill createTransactionWithToken)', () => {
  it('charges the saved card once, for the payer Grow captured, keyed by the charge serial', async () => {
    const { grow, wire, token } = await ready();
    wire.reply(RECORDED_TOKEN_CHARGE_PAID);
    await grow.charge(chargeOf(token));
    expect(wire.requests).toEqual([
      expect.objectContaining({
        method: GROW_WIRE_METHOD.CREATE_TRANSACTION_WITH_TOKEN,
        fields: expect.objectContaining({
          userId: GROW_USER_ID,
          cardToken: SAVED_CARD_TOKEN,
          paymentType: REGULAR_PAYMENT_TYPE,
          paymentNum: SINGLE_PAYMENT,
          'pageField[fullName]': PAYER_FULL_NAME,
          'pageField[phone]': PAYER_PHONE,
          transactionUniqueIdentifier: String(CHARGE_SERIAL),
        }),
      }),
    ]);
  });

  it.each(amounts)('sends $amountMinor agorot as the shekel sum $sum (ADR 0004)', async ({ amountMinor, sum }) => {
    const { grow, wire, token } = await ready();
    wire.reply(RECORDED_TOKEN_CHARGE_PAID);
    await grow.charge(chargeOf(token, { amountMinor }));
    expect(wire.requests[0]?.fields).toEqual(expect.objectContaining({ sum }));
  });
});

describe('growProvider.charge: outcomes', () => {
  it('succeeds with a charge ref when Grow reports it paid', async () => {
    const { grow, wire, token } = await ready();
    wire.reply(RECORDED_TOKEN_CHARGE_PAID);
    expect(await grow.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.SUCCEEDED,
      providerChargeRef: expect.any(String),
    });
  });

  it("fails with Grow's message when the card company declines", async () => {
    const { grow, wire, token } = await ready();
    wire.reply(RECORDED_STOLEN_CARD);
    expect(await grow.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.FAILED,
      providerChargeRef: undefined,
      reason: RECORDED_STOLEN_CARD_MESSAGE,
    });
  });

  it('fails when Grow no longer accepts the token', async () => {
    const { grow, wire, token } = await ready();
    wire.reply(RECORDED_BAD_TOKEN);
    expect(await grow.charge(chargeOf(token))).toEqual({
      outcome: CHARGE_STATUS.FAILED,
      providerChargeRef: undefined,
      reason: RECORDED_BAD_TOKEN_MESSAGE,
    });
  });
});

describe('growProvider.charge: an answer it cannot vouch for throws, so the charge stays pending for reconcile (ADR 0017)', () => {
  it('throws on a status 1 reply whose transaction is not paid', async () => {
    const { grow, wire, token } = await ready();
    wire.reply(transactionInfoReply(NOT_PAID_STATUS_CODE, '49.00'));
    await expect(grow.charge(chargeOf(token))).rejects.toThrow();
  });

  it('throws on an unreadable reply', async () => {
    const { grow, wire, token } = await ready();
    wire.reply(BLOCK_PAGE);
    await expect(grow.charge(chargeOf(token))).rejects.toThrow();
  });

  it('throws when the network call fails', async () => {
    const { grow, wire, token } = await ready();
    wire.rejectWith(new TypeError('fetch failed'));
    await expect(grow.charge(chargeOf(token))).rejects.toThrow();
  });
});

describe('growProvider.charge: what it refuses before calling Grow', () => {
  it('refuses a currency other than ILS (ADR 0004)', async () => {
    const { grow, wire, token } = await ready();
    await expect(grow.charge(chargeOf(token, { currency: CURRENCY.USD }))).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });

  it.each([0n, -1n, LARGEST_GROW_IDENTIFIER + 1n])(
    'refuses serial %s, which Grow cannot take as a unique identifier',
    async (chargeSerial) => {
      const { grow, wire, token } = await ready();
      await expect(grow.charge(chargeOf(token, { chargeSerial }))).rejects.toThrow();
      expect(wire.requests).toEqual([]);
    },
  );

  it('refuses a payment method token it did not issue', async () => {
    const { grow, wire } = growUnderTest();
    await expect(grow.charge(chargeOf(SAVED_CARD_TOKEN))).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });
});
