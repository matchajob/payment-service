import { API_INTRODUCTION } from '@/api/openapi/api-introduction';
import { API_TAG_DESCRIPTIONS } from '@/api/openapi/api-tags';
import { componentSchemas } from '@/api/openapi/component-schemas';
import { chargePaths } from '@/api/openapi/charge-paths';
import { customerPaths } from '@/api/openapi/customer-paths';
import { eventPaths } from '@/api/openapi/event-paths';
import { eventWebhooks } from '@/api/openapi/event-webhooks';
import { planPaths } from '@/api/openapi/plan-paths';
import { subscriptionPaths } from '@/api/openapi/subscription-paths';

const OPENAPI_VERSION = '3.1.0';
const API_VERSION = '1.0.0';
const BEARER_AUTH = 'bearerAuth';

export const buildOpenApiDocument = () => ({
  openapi: OPENAPI_VERSION,
  info: { title: 'Payment Service API', version: API_VERSION, description: API_INTRODUCTION },
  servers: [
    {
      url: '{baseUrl}',
      description: 'Your API base URL, given at onboarding',
      variables: { baseUrl: { default: 'https://payments.example.com' } },
    },
  ],
  security: [{ [BEARER_AUTH]: [] }],
  tags: API_TAG_DESCRIPTIONS,
  paths: { ...planPaths, ...customerPaths, ...subscriptionPaths, ...chargePaths, ...eventPaths },
  webhooks: eventWebhooks(),
  components: {
    securitySchemes: { [BEARER_AUTH]: { type: 'http', scheme: 'bearer', description: 'Your application API key.' } },
    schemas: componentSchemas(),
  },
});
