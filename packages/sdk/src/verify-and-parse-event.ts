import { EVENT_TOLERANCE_SECONDS, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/contract/event-signature';
import { outboundEventSchema, type OutboundEvent } from '@/contract/outbound-event';
import { EVENT_REJECTION } from '@sdk/event-rejection';
import { EventVerificationError } from '@sdk/event-verification-error';
import { hasValidSignature } from '@sdk/has-valid-signature';
import { readHeader, type HeaderBag } from '@sdk/read-header';

const MS_PER_SECOND = 1_000;
const WHOLE_NUMBER = /^\d+$/;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

export const verifyAndParseEvent = async (
  rawBody: string,
  headers: HeaderBag,
  secret: string,
  now: Date,
): Promise<OutboundEvent> => {
  const rawTimestamp = readHeader(headers, TIMESTAMP_HEADER);
  const signature = readHeader(headers, SIGNATURE_HEADER);
  if (rawTimestamp === undefined || signature === undefined || !WHOLE_NUMBER.test(rawTimestamp)) {
    throw new EventVerificationError(EVENT_REJECTION.INVALID_HEADERS);
  }

  const timestamp = Number(rawTimestamp);
  const nowSeconds = Math.floor(now.getTime() / MS_PER_SECOND);
  if (Math.abs(nowSeconds - timestamp) > EVENT_TOLERANCE_SECONDS) {
    throw new EventVerificationError(EVENT_REJECTION.STALE_TIMESTAMP);
  }
  if (!(await hasValidSignature(secret, timestamp, rawBody, signature))) {
    throw new EventVerificationError(EVENT_REJECTION.BAD_SIGNATURE);
  }

  const event = outboundEventSchema.safeParse(parseJson(rawBody));
  if (!event.success) throw new EventVerificationError(EVENT_REJECTION.MALFORMED_EVENT);
  return event.data;
};
