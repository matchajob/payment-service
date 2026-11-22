import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from '@/api/openapi/build-openapi-document';
import { testDb } from '@tests/utils/db';
import { WEBHOOKS_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';

const ALL_METHODS = 'ALL';
const TENANT_PREFIX = '/v1/';
const TRAILING_SLASH = /\/$/;
const HONO_PARAM = /:(\w+)/g;

describe('the API reference documents every tenant-facing route', () => {
  const app = testApp(testDb());

  it('has an operation for every route the router serves, and none for a route that is gone', () => {
    const served = app.routes
      .filter(
        (route) =>
          route.method !== ALL_METHODS && route.path.startsWith(TENANT_PREFIX) && !route.path.startsWith(WEBHOOKS_PATH),
      )
      .map((route) => `${route.method} ${route.path.replace(TRAILING_SLASH, '').replace(HONO_PARAM, '{$1}')}`);
    const documented = Object.entries(buildOpenApiDocument().paths).flatMap(([path, item]) =>
      Object.keys(item).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect([...documented].sort()).toEqual([...served].sort());
  });
});
