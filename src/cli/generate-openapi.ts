import { writeFile } from 'node:fs/promises';
import { buildOpenApiDocument } from '@/api/openapi/build-openapi-document';
import { PUBLISHED_OPENAPI_PATH } from '@/api/openapi/published-openapi-path';
import { serializeOpenApiDocument } from '@/api/openapi/serialize-openapi-document';

await writeFile(PUBLISHED_OPENAPI_PATH, serializeOpenApiDocument(buildOpenApiDocument()));
