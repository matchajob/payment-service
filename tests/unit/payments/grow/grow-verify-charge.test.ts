import { describe, expect, it } from 'vitest';
import { CURRENCY } from '@/lib/money/currency';
import type { VerifyChargeRequest } from '@/lib/payments/provider';
import { VERIFY_OUTCOME } from '@/lib/payments/verify-outcome';
import {
  GROW_STATUS_CODE,
  SAVED_CARD_TOKEN,
  tokenTransactionsReply,
  transactionInfoReply,
} from '@tests/utils/grow-built-replies';
import { growUnderTest, savedCardToken, type GrowUnderTest } from '@tests/utils/grow-provider-under-test';
import {
  BLOCK_PAGE,
  RECORDED_TOKEN_CHARGE_PAID,
  RECORDED_TRANSACTION_ID,
  RECORDED_TRANSACTION_INFO_PAID,
  RECORDED_TRANSACTION_INFO_PAID_MINOR,
  RECORDED_TRANSACTION_TOKEN,
  RECORDED_UNKNOWN_TRANSACTION,
} from '@tests/utils/grow-recorded-replies';
import { GROW_PAGE_CODE, GROW_USER_ID } from '@tests/utils/provider-credentials-fixtures';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';

const CHARGE_SERIAL = 41n;
const PLAN_MINOR = 4900;
const PLAN_SUM = '49.00';
const DEDUP_KEY = 'c1a7e3f0-8b2d-4e5f-9a6b-7c8d9e0f1a2b:2026-02-15T10:00:00.000Z:0';
const DENIED_STATUS = 'נדחה';
const LOOKED_UP_TRANSACTION_ID = '33600000';
const LOOKED_UP_TRANSACTION_TOKEN = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

const chargedRef = async ({ grow, wire }: GrowUnderTest, paymentMethodToken: string) => {
  wire.reply(RECORDED_TOKEN_CHARGE_PAID);
  const result = await grow.charge({
    paymentMethodToken,
    amountMinor: PLAN_MINOR,
    currency: CURRENCY.ILS,
    dedupKey: DEDUP_KEY,
    chargeSerial: CHARGE_SERIAL,
  });
  wire.requests.length = 0;
  if (result.providerChargeRef === undefined) throw new Error('grow test charge returned no ref');
  return result.providerChargeRef;
};

const ready = async () => {
  const under = growUnderTest();
  const paymentMethodToken = await savedCardToken(under);
  const withRef = async (): Promise<VerifyChargeRequest> => ({
    dedupKey: DEDUP_KEY,
    providerChargeRef: await chargedRef(under, paymentMethodToken),
    paymentMethodToken,
    chargeSerial: CHARGE_SERIAL,
  });
  const withoutRef: VerifyChargeRequest = {
    dedupKey: DEDUP_KEY,
    providerChargeRef: null,
    paymentMethodToken,
    chargeSerial: CHARGE_SERIAL,
  };
  return { ...under, withRef, withoutRef };
};

describe("growProvider.verifyCharge with Grow's ref (ADR 0017)", () => {
  it('looks the transaction up by the id and token the charge returned', async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(RECORDED_TRANSACTION_INFO_PAID);
    await grow.verifyCharge(request);
    expect(wire.requests).toEqual([
      expect.objectContaining({
        method: GROW_WIRE_METHOD.GET_TRANSACTION_INFO,
        fields: expect.objectContaining({
          pageCode: GROW_PAGE_CODE,
          transactionId: RECORDED_TRANSACTION_ID,
          transactionToken: RECORDED_TRANSACTION_TOKEN,
        }),
      }),
    ]);
  });

  it("reports a paid transaction as succeeded with Grow's amount in agorot, so reconcile can compare it", async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(RECORDED_TRANSACTION_INFO_PAID);
    expect(await grow.verifyCharge(request)).toEqual({
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: request.providerChargeRef,
      amountMinor: RECORDED_TRANSACTION_INFO_PAID_MINOR,
      currency: CURRENCY.ILS,
    });
  });

  it('reports a denied transaction as failed', async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(transactionInfoReply(GROW_STATUS_CODE.DENIED, PLAN_SUM, DENIED_STATUS));
    expect(await grow.verifyCharge(request)).toEqual({
      outcome: VERIFY_OUTCOME.FAILED,
      providerChargeRef: request.providerChargeRef,
      reason: expect.any(String),
    });
  });

  it('reports a transaction not yet paid as pending', async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(transactionInfoReply(GROW_STATUS_CODE.NOT_PAID, PLAN_SUM));
    expect(await grow.verifyCharge(request)).toEqual({ outcome: VERIFY_OUTCOME.PENDING });
  });

  it('reports a status code it does not know as pending, never as a settlement', async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(transactionInfoReply(GROW_STATUS_CODE.SUSPENDED, PLAN_SUM));
    expect(await grow.verifyCharge(request)).toEqual({ outcome: VERIFY_OUTCOME.PENDING });
  });

  it('throws when Grow refuses the lookup, rather than calling a charge it gave us a ref for lost', async () => {
    const { grow, wire, withRef } = await ready();
    const request = await withRef();
    wire.reply(RECORDED_UNKNOWN_TRANSACTION);
    await expect(grow.verifyCharge(request)).rejects.toThrow();
  });
});

describe('growProvider.verifyCharge by our reference, for a charge that timed out (ADR 0017)', () => {
  it('looks the transaction up by the card token and the charge serial only', async () => {
    const { grow, wire, withoutRef } = await ready();
    wire.reply(tokenTransactionsReply());
    await grow.verifyCharge(withoutRef);
    expect(wire.requests).toEqual([
      expect.objectContaining({
        method: GROW_WIRE_METHOD.GET_TOKEN_TRANSACTIONS_BY_EXTERNAL_IDENTIFIERS,
        fields: {
          userId: GROW_USER_ID,
          cardToken: SAVED_CARD_TOKEN,
          transactionUniqueIdentifier: String(CHARGE_SERIAL),
        },
      }),
    ]);
  });

  it('reports a paid transaction as succeeded with a ref that later lookups can use', async () => {
    const { grow, wire, withoutRef } = await ready();
    wire.reply(
      tokenTransactionsReply({
        statusCode: GROW_STATUS_CODE.PAID,
        sum: PLAN_SUM,
        cardToken: SAVED_CARD_TOKEN,
        transactionId: LOOKED_UP_TRANSACTION_ID,
        transactionToken: LOOKED_UP_TRANSACTION_TOKEN,
      }),
    );
    const verified = await grow.verifyCharge(withoutRef);
    expect(verified).toEqual({
      outcome: VERIFY_OUTCOME.SUCCEEDED,
      providerChargeRef: expect.any(String),
      amountMinor: PLAN_MINOR,
      currency: CURRENCY.ILS,
    });

    if (verified.outcome !== VERIFY_OUTCOME.SUCCEEDED) throw new Error('expected a settled charge');
    wire.reply(RECORDED_TRANSACTION_INFO_PAID);
    await grow.verifyCharge({ ...withoutRef, providerChargeRef: verified.providerChargeRef });
    expect(wire.requests.at(-1)?.fields).toEqual(
      expect.objectContaining({
        transactionId: LOOKED_UP_TRANSACTION_ID,
        transactionToken: LOOKED_UP_TRANSACTION_TOKEN,
      }),
    );
  });

  it('reports not found only when Grow returns no transaction for the serial', async () => {
    const { grow, wire, withoutRef } = await ready();
    wire.reply(tokenTransactionsReply());
    expect(await grow.verifyCharge(withoutRef)).toEqual({ outcome: VERIFY_OUTCOME.NOT_FOUND });
  });

  it('throws when Grow refuses the lookup, since a refusal is not proof that nothing was charged', async () => {
    const { grow, wire, withoutRef } = await ready();
    wire.reply(RECORDED_UNKNOWN_TRANSACTION);
    await expect(grow.verifyCharge(withoutRef)).rejects.toThrow();
  });

  it('throws on an unreadable reply', async () => {
    const { grow, wire, withoutRef } = await ready();
    wire.reply(BLOCK_PAGE);
    await expect(grow.verifyCharge(withoutRef)).rejects.toThrow();
  });
});
