import { describe, expect, it } from 'vitest';
import { WEBHOOK_KIND } from '@/lib/payments/webhook-kind';
import { GROW_TEST_REFERENCE, growUnderTest, startedSessionRef } from '@tests/utils/grow-provider-under-test';
import {
  RECORDED_CREATE_PROCESS_OK,
  RECORDED_NOTIFY_PROCESS_ID,
  RECORDED_NOTIFY_PROCESS_TOKEN,
  RECORDED_PROCESS_ID,
  RECORDED_PROCESS_TOKEN,
  RECORDED_TOKEN_SAVE_NOTIFY,
} from '@tests/utils/grow-recorded-replies';

const REFERENCE_FIELD = 'data[customFields][cField1]';
const STATUS_FIELD = 'status';
const FAILED_STATUS = '0';

const notifyWith = (edit: (params: URLSearchParams) => void): string => {
  const params = new URLSearchParams(RECORDED_TOKEN_SAVE_NOTIFY);
  edit(params);
  return params.toString();
};

const ourNotify = notifyWith((params) => params.set(REFERENCE_FIELD, GROW_TEST_REFERENCE));

const sameProcessAsNotify = RECORDED_CREATE_PROCESS_OK.replace(RECORDED_PROCESS_ID, RECORDED_NOTIFY_PROCESS_ID).replace(
  RECORDED_PROCESS_TOKEN,
  RECORDED_NOTIFY_PROCESS_TOKEN,
);
const sameProcessWithNumericId = sameProcessAsNotify.replace(
  `"processId":"${RECORDED_NOTIFY_PROCESS_ID}"`,
  `"processId":${RECORDED_NOTIFY_PROCESS_ID}`,
);

describe('growProvider.parseWebhook: a notify only triggers verification (webhook-trust rule 3, grow skill Notify)', () => {
  it('reads a form-encoded notify as a checkout completion carrying our reference', () => {
    const { grow } = growUnderTest();
    expect(grow.parseWebhook(ourNotify)).toEqual({
      kind: WEBHOOK_KIND.CHECKOUT_COMPLETED,
      reference: GROW_TEST_REFERENCE,
      sessionRef: expect.any(String),
    });
  });

  it('names the same session ref that startCheckout returned for that process, so completeCheckout finds it', async () => {
    const under = growUnderTest();
    const started = await startedSessionRef(under, sameProcessAsNotify);
    expect(under.grow.parseWebhook(ourNotify)).toEqual(expect.objectContaining({ sessionRef: started }));
  });

  it('names the same session ref when Grow sent the processId as a number at checkout', async () => {
    const under = growUnderTest();
    const started = await startedSessionRef(under, sameProcessWithNumericId);
    expect(under.grow.parseWebhook(ourNotify)).toEqual(expect.objectContaining({ sessionRef: started }));
  });

  it('ignores a notify without our reference', () => {
    const { grow } = growUnderTest();
    expect(grow.parseWebhook(RECORDED_TOKEN_SAVE_NOTIFY)).toEqual({ kind: WEBHOOK_KIND.UNRECOGNIZED });
  });

  it('ignores a notify that reports a failure', () => {
    const { grow } = growUnderTest();
    const failed = notifyWith((params) => {
      params.set(REFERENCE_FIELD, GROW_TEST_REFERENCE);
      params.set(STATUS_FIELD, FAILED_STATUS);
    });
    expect(grow.parseWebhook(failed)).toEqual({ kind: WEBHOOK_KIND.UNRECOGNIZED });
  });

  it('ignores a notify without the process identifiers', () => {
    const { grow } = growUnderTest();
    const anonymous = notifyWith((params) => {
      params.set(REFERENCE_FIELD, GROW_TEST_REFERENCE);
      params.delete('data[processToken]');
    });
    expect(grow.parseWebhook(anonymous)).toEqual({ kind: WEBHOOK_KIND.UNRECOGNIZED });
  });

  it('ignores a body that is not a Grow notify', () => {
    const { grow } = growUnderTest();
    expect(grow.parseWebhook(JSON.stringify({ reference: GROW_TEST_REFERENCE }))).toEqual({
      kind: WEBHOOK_KIND.UNRECOGNIZED,
    });
    expect(grow.parseWebhook('')).toEqual({ kind: WEBHOOK_KIND.UNRECOGNIZED });
  });
});
