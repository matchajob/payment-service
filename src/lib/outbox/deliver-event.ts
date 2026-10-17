import { SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/contract/event-signature';
import type { DeliveryResult } from '@/lib/outbox/delivery-result';
import type { OutboxEvent } from '@/lib/outbox/schema';
import { signPayload } from '@/lib/outbox/sign-payload';
import { toOutboundEvent } from '@/lib/outbox/to-outbound-event';
import type { DeliveryTarget } from '@/lib/tenants/find-delivery-targets';

const MS_PER_SECOND = 1_000;
const POST = 'POST';
const JSON_CONTENT_TYPE = 'application/json';
const TIMEOUT_ERROR_NAME = 'TimeoutError';
const TIMEOUT_ERROR = 'timeout';

const describeFailure = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  if (error.name === TIMEOUT_ERROR_NAME) return TIMEOUT_ERROR;
  return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
};

export const deliverEvent = async (
  target: DeliveryTarget,
  event: OutboxEvent,
  now: Date,
  timeoutMs: number,
): Promise<DeliveryResult> => {
  try {
    const body = JSON.stringify(toOutboundEvent(event));
    const timestamp = Math.floor(now.getTime() / MS_PER_SECOND);
    const response = await fetch(target.webhookUrl, {
      method: POST,
      body,
      headers: {
        'content-type': JSON_CONTENT_TYPE,
        [TIMESTAMP_HEADER]: String(timestamp),
        [SIGNATURE_HEADER]: signPayload(target.webhookSecret, timestamp, body),
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    return response.ok ? { delivered: true } : { delivered: false, error: `HTTP ${response.status}` };
  } catch (error) {
    return { delivered: false, error: describeFailure(error) };
  }
};
