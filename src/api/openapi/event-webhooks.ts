import { jsonBody } from '@/api/openapi/json-response';
import type { OpenApiOperation } from '@/api/openapi/openapi-types';
import { componentRef } from '@/api/openapi/to-openapi-schema';
import { EVENT_TOLERANCE_SECONDS, SIGNATURE_HEADER, TIMESTAMP_HEADER } from '@/contract/event-signature';
import { EVENT_WEBHOOK_COPY, type EventType } from '@/api/openapi/event-webhook-copy';
import { outboundEventSchema } from '@/contract/outbound-event';
import { z } from 'zod';

const EVENT_ID = z.globalRegistry.get(outboundEventSchema)?.id ?? '';
const ACKNOWLEDGED = '2XX';
const SECONDS_PER_MINUTE = 60;

const SIGNATURE_PARAMETERS = [
  {
    name: SIGNATURE_HEADER,
    in: 'header' as const,
    required: true,
    description: `Hex HMAC-SHA256 of \`{timestamp}.{raw body}\` keyed with your webhook secret. Compare in constant time.`,
    schema: { type: 'string' },
  },
  {
    name: TIMESTAMP_HEADER,
    in: 'header' as const,
    required: true,
    description: `Unix seconds when the delivery was signed. Reject a delivery more than ${EVENT_TOLERANCE_SECONDS / SECONDS_PER_MINUTE} minutes from your clock.`,
    schema: { type: 'string' },
  },
];

const webhookFor = (type: EventType): { post: Omit<OpenApiOperation, 'tags'> } => ({
  post: {
    operationId: type,
    summary: EVENT_WEBHOOK_COPY[type].summary,
    description: EVENT_WEBHOOK_COPY[type].description,
    parameters: SIGNATURE_PARAMETERS,
    requestBody: jsonBody(componentRef(EVENT_ID)),
    responses: {
      [ACKNOWLEDGED]: {
        description:
          'Any 2xx acknowledges the event. Anything else, or no answer within the timeout, schedules a retry: 8 attempts over about 27 hours.',
      },
    },
  },
});

export const eventWebhooks = () =>
  Object.fromEntries(outboundEventSchema.shape.type.options.map((type) => [type, webhookFor(type)]));
