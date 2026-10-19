import { describe, expect, it } from 'vitest';
import { CHECKOUT_VERIFICATION } from '@/lib/payments/checkout-verification';
import {
  cardSavedReply,
  GROW_STATUS_CODE,
  processInfoReply,
  SAVED_CARD_TOKEN,
  unpaidProcessReply,
} from '@tests/utils/grow-built-replies';
import { growUnderTest, startedSessionRef } from '@tests/utils/grow-provider-under-test';
import { BLOCK_PAGE, RECORDED_PROCESS_ID, RECORDED_PROCESS_TOKEN } from '@tests/utils/grow-recorded-replies';
import { GROW_PAGE_CODE } from '@tests/utils/provider-credentials-fixtures';
import { GROW_WIRE_METHOD } from '@tests/utils/grow-wire-methods';

const BAD_PROCESS = '{"status":0,"err":{"id":730,"message":"bad process"},"data":""}';

describe("growProvider.verifyCheckout: Grow's own lookup decides, not the notify (webhook-trust rule 3)", () => {
  it('asks Grow about the process the session ref names, on the merchant page', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(cardSavedReply());
    await under.grow.verifyCheckout(sessionRef);
    expect(under.wire.requests.at(-1)).toEqual(
      expect.objectContaining({
        method: GROW_WIRE_METHOD.GET_PAYMENT_PROCESS_INFO,
        fields: expect.objectContaining({
          pageCode: GROW_PAGE_CODE,
          processId: RECORDED_PROCESS_ID,
          processToken: RECORDED_PROCESS_TOKEN,
        }),
      }),
    );
  });

  it('reports the card saved when the process holds a suspended row with a card token', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(cardSavedReply());
    expect(await under.grow.verifyCheckout(sessionRef)).toEqual({
      outcome: CHECKOUT_VERIFICATION.CARD_SAVED,
      paymentMethodToken: expect.any(String),
    });
  });

  it('gives different payment method tokens to different cards', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(cardSavedReply());
    under.wire.reply(cardSavedReply(`${SAVED_CARD_TOKEN}0`));
    const first = await under.grow.verifyCheckout(sessionRef);
    const second = await under.grow.verifyCheckout(sessionRef);
    expect(first).not.toEqual(second);
  });

  it('reports not completed while the payer has not finished the page', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(unpaidProcessReply());
    expect(await under.grow.verifyCheckout(sessionRef)).toEqual({ outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED });
  });

  it('reports not completed for a suspended row that carries no card token', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(processInfoReply({ statusCode: GROW_STATUS_CODE.SUSPENDED }));
    expect(await under.grow.verifyCheckout(sessionRef)).toEqual({ outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED });
  });

  it('reports not completed for a row that charged instead of only saving', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(processInfoReply({ statusCode: GROW_STATUS_CODE.PAID, cardToken: SAVED_CARD_TOKEN }));
    expect(await under.grow.verifyCheckout(sessionRef)).toEqual({ outcome: CHECKOUT_VERIFICATION.NOT_COMPLETED });
  });

  it('throws when Grow refuses the lookup, so the webhook answers 500 and Grow sends it again', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(BAD_PROCESS);
    await expect(under.grow.verifyCheckout(sessionRef)).rejects.toThrow();
  });

  it('throws on an unreadable reply', async () => {
    const under = growUnderTest();
    const sessionRef = await startedSessionRef(under);
    under.wire.reply(BLOCK_PAGE);
    await expect(under.grow.verifyCheckout(sessionRef)).rejects.toThrow();
  });

  it('throws on a session ref it did not issue, without calling Grow', async () => {
    const { grow, wire } = growUnderTest();
    await expect(grow.verifyCheckout('session-1')).rejects.toThrow();
    expect(wire.requests).toEqual([]);
  });
});
