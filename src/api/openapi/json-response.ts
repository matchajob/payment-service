import type { JsonSchema, OpenApiResponse } from '@/api/openapi/openapi-types';

export const JSON_CONTENT_TYPE = 'application/json';

export const jsonResponse = (description: string, schema: JsonSchema): OpenApiResponse => ({
  description,
  content: { [JSON_CONTENT_TYPE]: { schema } },
});

export const jsonBody = (schema: JsonSchema) => ({ required: true, content: { [JSON_CONTENT_TYPE]: { schema } } });
