import { describe, expect, it } from 'vitest';
import { createApp } from '@/api/app';
import { problemSchema } from '@/contract/problem';
import { createTenant } from '@/lib/tenants/create-tenant';
import { testDb, withRollback } from '@tests/utils/db';
import { postJson } from '@tests/utils/post-json';
import { silentLogger } from '@tests/utils/silent-logger';
import { ACME, GLOBEX } from '@tests/utils/tenant-fixtures';

const EXTERNAL_REF = 'user-42';

describe('POST /v1/customers', () => {
  it('creates a customer and answers 201 with its public fields', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request(
        '/v1/customers',
        postJson(apiKey, { externalRef: EXTERNAL_REF }),
      );
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ data: { customerId: expect.any(String), externalRef: EXTERNAL_REF } });
    });
  });

  it('rejects a body without externalRef with 400 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/customers', postJson(apiKey, {}));
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(400);
    });
  });

  it('rejects an empty externalRef with 400', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request(
        '/v1/customers',
        postJson(apiKey, { externalRef: '' }),
      );
      expect(res.status).toBe(400);
    });
  });

  it('rejects malformed JSON with 400 instead of 500', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const res = await createApp({ logger: silentLogger, db: tx }).request('/v1/customers', {
        ...postJson(apiKey, {}),
        body: '{ not json',
      });
      expect(res.status).toBe(400);
    });
  });

  it('rejects a duplicate externalRef for the same tenant with 409 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = createApp({ logger: silentLogger, db: tx });
      await app.request('/v1/customers', postJson(apiKey, { externalRef: EXTERNAL_REF }));
      const res = await app.request('/v1/customers', postJson(apiKey, { externalRef: EXTERNAL_REF }));
      expect(res.status).toBe(409);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(problemSchema.parse(await res.json()).status).toBe(409);
    });
  });

  it('accepts the same externalRef under another tenant', async () => {
    await withRollback(testDb(), async (tx) => {
      const acme = await createTenant(tx, ACME);
      const globex = await createTenant(tx, GLOBEX);
      const app = createApp({ logger: silentLogger, db: tx });
      await app.request('/v1/customers', postJson(acme.apiKey, { externalRef: EXTERNAL_REF }));
      const res = await app.request('/v1/customers', postJson(globex.apiKey, { externalRef: EXTERNAL_REF }));
      expect(res.status).toBe(201);
    });
  });
});
