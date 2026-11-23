import type { ZodObject } from 'zod';
import type { OpenApiParameter } from '@/api/openapi/openapi-types';
import { toOpenApiSchema } from '@/api/openapi/to-openapi-schema';

const NO_DESCRIPTION = '';

export const queryParameters = (query: ZodObject): OpenApiParameter[] =>
  Object.entries(query.shape).map(([name, field]) => {
    const { description, ...schema } = toOpenApiSchema(field, 'output');
    return {
      name,
      in: 'query',
      required: false,
      description: typeof description === 'string' ? description : NO_DESCRIPTION,
      schema,
    };
  });
