import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import { CHECKOUT_MODE } from '@/lib/payments/checkout-mode';
import type { CheckoutRequest } from '@/lib/payments/provider';
import {
  GROW_TEST_NOTIFY_URL,
  GROW_TEST_PLAN_MINOR,
  GROW_TEST_REFERENCE,
  GROW_TEST_RETURN_URL,
  growUnderTest,
} from '@tests/utils/grow-provider-under-test';
import {
  RECORDED_CHECKOUT_URL,
  RECORDED_CREATE_PROCESS_OK,
  RECORDED_MISSING_FIELD,
  RECORDED_PROCESS_ID,
  RECORDED_PROCESS_TOKEN,
} from '@tests/utils/grow-recorded-replies';
import { GROW_PAGE_CODE, GROW_USER_ID } from '@tests/utils/provider-credentials-fixtures';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';

const CREATE_TOKEN_CHARGE_TYPE = '3';
const SAVE_CARD_TOKEN = '1';
const TOKEN_ONLY_SUM = '1';

const capture: CheckoutRequest = {
  mode: CHECKOUT_MODE.CAPTURE,
  reference: GROW_TEST_REFERENCE,
  amountMinor: GROW_TEST_PLAN_MINOR,
  currency: CURRENCY.ILS,
  returnUrl: GROW_TEST_RETURN_URL,
};

describe('growProvider.startCheckout: a card-only save (ADR 0007, grow skill createPaymentProcess)', () => {
  it("opens a token-only payment page on the merchant's page, carrying our reference and this connection's notify URL", async () => {
    const { grow, wire } = growUnderTest();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    await grow.startCheckout(capture);
    expect(wire.requests).toEqual([
      expect.objectContaining({
        method: GROW_WIRE_METHOD.CREATE_PAYMENT_PROCESS,
        fields: expect.objectContaining({
          userId: GROW_USER_ID,
          pageCode: GROW_PAGE_CODE,
          chargeType: CREATE_TOKEN_CHARGE_TYPE,
          saveCardToken: SAVE_CARD_TOKEN,
          sum: TOKEN_ONLY_SUM,
          successUrl: GROW_TEST_RETURN_URL,
          cancelUrl: GROW_TEST_RETURN_URL,
          notifyUrl: GROW_TEST_NOTIFY_URL,
          cField1: GROW_TEST_REFERENCE,
        }),
      }),
    ]);
  });

  it("returns Grow's page URL and a session ref the payer never sees in it", async () => {
    const { grow, wire } = growUnderTest();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    const session = await grow.startCheckout(capture);
    expect(session.checkoutUrl).toBe(RECORDED_CHECKOUT_URL);
    expect(session.checkoutUrl).not.toContain(RECORDED_PROCESS_TOKEN);
    expect(session.providerSessionRef).not.toBe('');
  });

  it('gives a different session ref to a different process', async () => {
    const { grow, wire } = growUnderTest();
    wire.reply(RECORDED_CREATE_PROCESS_OK);
    wire.reply(RECORDED_CREATE_PROCESS_OK.replace(RECORDED_PROCESS_ID, `${RECORDED_PROCESS_ID}1`));
    const first = await grow.startCheckout(capture);
    const second = await grow.startCheckout(capture);
    expect(second.providerSessionRef).not.toBe(first.providerSessionRef);
  });

  it('throws when Grow refuses to open the page, so no subscription points at a dead session', async () => {
    const { grow, wire } = growUnderTest();
    wire.reply(RECORDED_MISSING_FIELD);
    await expect(grow.startCheckout(capture)).rejects.toThrow();
  });
});

describe('growProvider.startCheckout: what it refuses before calling Grow', () => {
  it('refuses a charge-mode checkout, which v1 never starts (ADR 0007)', async () => {
    const { grow, wire } = growUnderTest();
    await expect(grow.startCheckout({ ...capture, mode: CHECKOUT_MODE.CHARGE })).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });

  it('refuses a currency other than ILS (ADR 0004)', async () => {
    const { grow, wire } = growUnderTest();
    await expect(grow.startCheckout({ ...capture, currency: CURRENCY.USD })).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });
});
