import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EVENT_TOLERANCE_SECONDS, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/contract/event-signature';
import type { OutboundEvent } from '@/contract/outbound-event';
import { signPayload } from '@/lib/outbox/sign-payload';
import { EVENT_REJECTION } from '@sdk/event-rejection';
import { EventVerificationError } from '@sdk/event-verification-error';
import { verifyAndParseEvent } from '@sdk/verify-and-parse-event';

const SECRET = 'whsec_test_secret';
const ACTIVATED = 'subscription.activated';
const NOW = new Date('2026-01-15T10:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1_000);

const EVENT: OutboundEvent = {
  eventId: randomUUID(),
  type: ACTIVATED,
  sequence: 1,
  occurredAt: NOW.toISOString(),
  subscription: {
    subscriptionId: randomUUID(),
    customerId: randomUUID(),
    customerExternalRef: 'user-42',
    planId: randomUUID(),
    status: 'active',
    entitled: true,
    currentPeriodEnd: '2026-02-15T10:00:00.000Z',
    cancelAtPeriodEnd: false,
    cancelReason: null,
    canceledAt: null,
  },
};
const BODY = JSON.stringify(EVENT);

const headersFor = (body: string, timestamp: number, secret = SECRET) => ({
  [TIMESTAMP_HEADER]: String(timestamp),
  [SIGNATURE_HEADER]: signPayload(secret, timestamp, body),
});

const reasonOf = async (attempt: Promise<unknown>) => {
  const failure = await attempt.catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(EventVerificationError);
  return failure instanceof EventVerificationError ? failure.reason : undefined;
};

describe('verifyAndParseEvent (Spec 5 rule 5, WORKPLAN 23)', () => {
  it('accepts an event the server signed and returns it parsed', async () => {
    expect(await verifyAndParseEvent(BODY, headersFor(BODY, NOW_SECONDS), SECRET, NOW)).toEqual(EVENT);
  });

  it('reads header names case-insensitively from a plain object', async () => {
    const lowered = Object.fromEntries(
      Object.entries(headersFor(BODY, NOW_SECONDS)).map(([name, value]) => [name.toLowerCase(), value]),
    );
    expect(await verifyAndParseEvent(BODY, lowered, SECRET, NOW)).toEqual(EVENT);
  });

  it('reads the headers from a Headers instance', async () => {
    const headers = new Headers(headersFor(BODY, NOW_SECONDS));
    expect(await verifyAndParseEvent(BODY, headers, SECRET, NOW)).toEqual(EVENT);
  });

  it('rejects a body changed after signing', async () => {
    const tampered = BODY.replace(ACTIVATED, 'subscription.canceled');
    expect(await reasonOf(verifyAndParseEvent(tampered, headersFor(BODY, NOW_SECONDS), SECRET, NOW))).toBe(
      EVENT_REJECTION.BAD_SIGNATURE,
    );
  });

  it('rejects an event signed with another secret', async () => {
    const headers = headersFor(BODY, NOW_SECONDS, `${SECRET}-other`);
    expect(await reasonOf(verifyAndParseEvent(BODY, headers, SECRET, NOW))).toBe(EVENT_REJECTION.BAD_SIGNATURE);
  });

  it('rejects a valid signature replayed under a fresh timestamp', async () => {
    const stale = headersFor(BODY, NOW_SECONDS - 10);
    const replayed = { ...stale, [TIMESTAMP_HEADER]: String(NOW_SECONDS) };
    expect(await reasonOf(verifyAndParseEvent(BODY, replayed, SECRET, NOW))).toBe(EVENT_REJECTION.BAD_SIGNATURE);
  });

  it('rejects a signature that is not hex', async () => {
    const headers = { ...headersFor(BODY, NOW_SECONDS), [SIGNATURE_HEADER]: 'not-hex-at-all' };
    expect(await reasonOf(verifyAndParseEvent(BODY, headers, SECRET, NOW))).toBe(EVENT_REJECTION.BAD_SIGNATURE);
  });

  it('accepts an event exactly at the tolerance edge and rejects one second past it', async () => {
    const edge = NOW_SECONDS - EVENT_TOLERANCE_SECONDS;
    expect(await verifyAndParseEvent(BODY, headersFor(BODY, edge), SECRET, NOW)).toEqual(EVENT);
    expect(await reasonOf(verifyAndParseEvent(BODY, headersFor(BODY, edge - 1), SECRET, NOW))).toBe(
      EVENT_REJECTION.STALE_TIMESTAMP,
    );
  });

  it('rejects a timestamp too far in the future', async () => {
    const future = headersFor(BODY, NOW_SECONDS + EVENT_TOLERANCE_SECONDS + 1);
    expect(await reasonOf(verifyAndParseEvent(BODY, future, SECRET, NOW))).toBe(EVENT_REJECTION.STALE_TIMESTAMP);
  });

  it.each([
    ['no signature header', { [TIMESTAMP_HEADER]: String(NOW_SECONDS) }],
    ['no timestamp header', { [SIGNATURE_HEADER]: 'abcd' }],
    ['a timestamp that is not a whole number', { ...headersFor(BODY, NOW_SECONDS), [TIMESTAMP_HEADER]: 'soon' }],
  ])('rejects %s', async (_, headers) => {
    expect(await reasonOf(verifyAndParseEvent(BODY, headers, SECRET, NOW))).toBe(EVENT_REJECTION.INVALID_HEADERS);
  });

  it('rejects a correctly signed body that is not an event of the contract', async () => {
    const unknownType = JSON.stringify({ ...EVENT, type: 'subscription.exploded' });
    expect(await reasonOf(verifyAndParseEvent(unknownType, headersFor(unknownType, NOW_SECONDS), SECRET, NOW))).toBe(
      EVENT_REJECTION.MALFORMED_EVENT,
    );
    const notJson = 'not json';
    expect(await reasonOf(verifyAndParseEvent(notJson, headersFor(notJson, NOW_SECONDS), SECRET, NOW))).toBe(
      EVENT_REJECTION.MALFORMED_EVENT,
    );
  });

  it('checks the signature before it parses, so an unsigned garbage body is a signature failure', async () => {
    const forged = { [TIMESTAMP_HEADER]: String(NOW_SECONDS), [SIGNATURE_HEADER]: 'abcd' };
    expect(await reasonOf(verifyAndParseEvent('not json', forged, SECRET, NOW))).toBe(EVENT_REJECTION.BAD_SIGNATURE);
  });
});
