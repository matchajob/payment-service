import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '@/api/openapi/build-openapi-document';
import { PUBLISHED_OPENAPI_PATH } from '@/api/openapi/published-openapi-path';
import { serializeOpenApiDocument } from '@/api/openapi/serialize-openapi-document';

describe('the published API reference', () => {
  it('is the document the contract builds today (regenerate with: pnpm tsx src/cli/generate-openapi.ts)', async () => {
    const published = await readFile(PUBLISHED_OPENAPI_PATH, 'utf8');
    expect(published).toBe(serializeOpenApiDocument(buildOpenApiDocument()));
  });
});
