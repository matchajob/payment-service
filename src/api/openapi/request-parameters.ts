import type { OpenApiParameter } from '@/api/openapi/openapi-types';

export const IDEMPOTENCY_KEY_PARAMETER: OpenApiParameter = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  description:
    'A UUID you generate once per intended change and reuse on every retry of it. The same key with the same body returns the stored answer without running the change again. Keys are kept for 24 hours.',
  schema: { type: 'string', format: 'uuid' },
};

export const idPathParameter = (name: string, description: string): OpenApiParameter => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
});
