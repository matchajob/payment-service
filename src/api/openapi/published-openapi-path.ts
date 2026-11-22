import { fileURLToPath } from 'node:url';

export const PUBLISHED_OPENAPI_PATH = fileURLToPath(new URL('../../../site/public/openapi.json', import.meta.url));
