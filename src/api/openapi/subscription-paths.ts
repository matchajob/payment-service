import { HTTP_STATUS } from '@/api/http-status';
import { API_TAG } from '@/api/openapi/api-tags';
import { jsonBody, jsonResponse } from '@/api/openapi/json-response';
import type { OpenApiPaths } from '@/api/openapi/openapi-types';
import {
  BAD_REQUEST_RESPONSE,
  IDEMPOTENCY_RESPONSES,
  NOT_FOUND_RESPONSE,
  problemResponse,
  RETRY_WITH_SAME_KEY,
  UNAUTHORIZED_RESPONSE,
} from '@/api/openapi/problem-responses';
import { IDEMPOTENCY_KEY_PARAMETER, idPathParameter } from '@/api/openapi/request-parameters';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';
import { createSubscriptionRequestSchema } from '@/contract/create-subscription-request';
import { createSubscriptionResponseSchema } from '@/contract/create-subscription-response';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import { updatePaymentMethodRequestSchema } from '@/contract/update-payment-method-request';
import { updatePaymentMethodResponseSchema } from '@/contract/update-payment-method-response';

const SUBSCRIPTION_ID = idPathParameter('subscriptionId', 'The subscription to act on.');
const subscriptionResponse = toOpenApiSchema(subscriptionResponseSchema, 'output');

const commandConflict = problemResponse(
  'The lifecycle refuses this change in the current state. The detail is the reason: `not_accepted_in_state`, `resume_not_allowed` (your policy turns resume off) or `store_managed`. A request with the same Idempotency-Key still running also answers 409.',
  RETRY_WITH_SAME_KEY,
);

const cancelConflict = problemResponse(
  'The lifecycle refuses the cancel (`not_accepted_in_state`, for example on a canceled subscription), or a charge for this subscription is running (`charge_in_flight`, retry after Retry-After). A request with the same Idempotency-Key still running also answers 409.',
  RETRY_WITH_SAME_KEY,
);

const commandResponses = {
  ...UNAUTHORIZED_RESPONSE,
  ...NOT_FOUND_RESPONSE,
  ...IDEMPOTENCY_RESPONSES,
  [HTTP_STATUS.CONFLICT]: commandConflict,
};

export const subscriptionPaths: OpenApiPaths = {
  '/v1/subscriptions': {
    post: {
      operationId: 'createSubscription',
      tags: [API_TAG.SUBSCRIPTIONS],
      summary: 'Create a subscription',
      description:
        'Creates an `incomplete` subscription and a hosted checkout on your card provider. Send the customer to `checkoutUrl`. When they pay, the first charge starts period one and you receive `subscription.activated`.\n\nIf nobody pays within your checkout window (12 hours by default), the subscription is canceled with `checkout_expired`. No event is sent for that, because nothing was ever active.\n\nIf the customer pays while another of their subscriptions is live, the new one is canceled with `already_subscribed`.',
      parameters: [IDEMPOTENCY_KEY_PARAMETER],
      requestBody: jsonBody(toOpenApiSchema(createSubscriptionRequestSchema, 'input')),
      responses: {
        [HTTP_STATUS.CREATED]: jsonResponse(
          'The new subscription and its checkout link.',
          toOpenApiSchema(createSubscriptionResponseSchema, 'output'),
        ),
        ...BAD_REQUEST_RESPONSE,
        ...UNAUTHORIZED_RESPONSE,
        [HTTP_STATUS.NOT_FOUND]: problemResponse('The customer or the plan does not exist in your application.'),
        ...IDEMPOTENCY_RESPONSES,
      },
    },
  },
  '/v1/subscriptions/{subscriptionId}': {
    get: {
      operationId: 'getSubscription',
      tags: [API_TAG.SUBSCRIPTIONS],
      summary: 'Retrieve a subscription',
      description:
        'Returns the current state of a subscription. You rarely need this: every event already carries the same object. Use it to backfill or to check one record.',
      parameters: [SUBSCRIPTION_ID],
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('The subscription.', subscriptionResponse),
        ...UNAUTHORIZED_RESPONSE,
        ...NOT_FOUND_RESPONSE,
      },
    },
  },
  '/v1/subscriptions/{subscriptionId}/cancel': {
    post: {
      operationId: 'cancelSubscription',
      tags: [API_TAG.SUBSCRIPTIONS],
      summary: 'Cancel a subscription',
      description:
        'What cancel does depends on the status:\n\n- `active`: sets `cancelAtPeriodEnd`. Access stays on until `currentPeriodEnd`, then the subscription ends with `customer_request` and no charge is made. Canceling again changes nothing.\n- `incomplete`: ends it at once.\n- `past_due`: ends it at once, stops the retries and sends `subscription.canceled`.\n- `canceled`: refused with a 409.',
      parameters: [SUBSCRIPTION_ID, IDEMPOTENCY_KEY_PARAMETER],
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('The subscription after the cancel.', subscriptionResponse),
        ...commandResponses,
        [HTTP_STATUS.CONFLICT]: cancelConflict,
      },
    },
  },
  '/v1/subscriptions/{subscriptionId}/resume': {
    post: {
      operationId: 'resumeSubscription',
      tags: [API_TAG.SUBSCRIPTIONS],
      summary: 'Resume a subscription',
      description:
        'Takes back a cancellation that has not taken effect yet: clears `cancelAtPeriodEnd` on an `active` subscription, so it renews as usual. Refused with `resume_not_allowed` when your policy turns resume off. A canceled subscription cannot be resumed; create a new one.',
      parameters: [SUBSCRIPTION_ID, IDEMPOTENCY_KEY_PARAMETER],
      responses: {
        [HTTP_STATUS.OK]: jsonResponse('The subscription after the resume.', subscriptionResponse),
        ...commandResponses,
      },
    },
  },
  '/v1/subscriptions/{subscriptionId}/update-payment-method': {
    post: {
      operationId: 'updatePaymentMethod',
      tags: [API_TAG.SUBSCRIPTIONS],
      summary: 'Update the payment method',
      description:
        'Creates a hosted checkout that saves a new card without charging it. Send the customer to `checkoutUrl`.\n\n- `active`: the new card is used from the next renewal.\n- `past_due`: the new card is charged at once for the failed period. Success makes the subscription `active` and sends `charge.succeeded`. A decline sends `charge.failed` and starts the retry schedule over.\n- `incomplete` or `canceled`: refused with a 409. An incomplete subscription has no card yet; its own checkout is the way in.\n\nEvery link you create keeps working, so an older link completed after a newer one still replaces the card.',
      parameters: [SUBSCRIPTION_ID, IDEMPOTENCY_KEY_PARAMETER],
      requestBody: jsonBody(toOpenApiSchema(updatePaymentMethodRequestSchema, 'input')),
      responses: {
        [HTTP_STATUS.CREATED]: jsonResponse(
          'The card update checkout link.',
          toOpenApiSchema(updatePaymentMethodResponseSchema, 'output'),
        ),
        ...BAD_REQUEST_RESPONSE,
        ...commandResponses,
      },
    },
  },
};
