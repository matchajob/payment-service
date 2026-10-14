import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { sha256Hex } from '@/lib/crypto/sha256-hex';
import { customersTable } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { RESERVATION_TTL_MS } from '@/lib/idempotency/reservation-ttl';
import { idempotencyKeysTable, zIdempotencyKeyRead } from '@/lib/idempotency/schema';
import { createTenant } from '@/lib/tenants/create-tenant';
import type { Tenant } from '@/lib/tenants/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { CUSTOMERS_PATH } from '@tests/utils/paths';
import { postJson } from '@tests/utils/post-json';
import { TEST_NOW, testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';

const BODY = { externalRef: 'user-42' };

const reserveDirectly = async (db: Database, tenantId: Tenant['tenantId'], key: string, reservedAt: Date) => {
  await db.insert(idempotencyKeysTable).values({
    tenantId,
    key: zIdempotencyKeyRead.shape.key.parse(key),
    requestHash: sha256Hex(JSON.stringify(BODY)),
    reservedAt,
    responseBody: null,
  });
};

describe('idempotency rules (Spec 3)', () => {
  it('rule 1: a retried request with the same key executes once', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const key = randomUUID();
      await app.request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      await app.request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      expect(await tx.$count(customersTable)).toBe(1);
    });
  });

  it('rule 2: a replay returns the stored response byte for byte', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const key = randomUUID();
      const first = await app.request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      const replay = await app.request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      expect(replay.status).toBe(first.status);
      expect(replay.headers.get('content-type')).toBe(first.headers.get('content-type'));
      expect(await replay.text()).toBe(await first.text());
    });
  });

  it('rule 3: the same key with a different body is 422', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const key = randomUUID();
      await app.request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      const res = await app.request(CUSTOMERS_PATH, postJson(apiKey, { externalRef: 'user-43' }, key));
      expect(res.status).toBe(422);
      expect(problemSchema.parse(await res.json()).status).toBe(422);
    });
  });

  it('rule 4: the same key while the first attempt is in flight is 409 with Retry-After: 1', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      const key = randomUUID();
      await reserveDirectly(tx, tenant.tenantId, key, TEST_NOW);
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      expect(res.status).toBe(409);
      expect(res.headers.get('retry-after')).toBe('1');
      expect(await tx.$count(customersTable)).toBe(0);
    });
  });

  it('rule 5: a reservation older than 90s is taken over and executes', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      const key = randomUUID();
      await reserveDirectly(tx, tenant.tenantId, key, new Date(TEST_NOW.getTime() - RESERVATION_TTL_MS - 1));
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      expect(res.status).toBe(201);
      expect(await tx.$count(customersTable)).toBe(1);
    });
  });

  it('rule 5 boundary: a reservation exactly 90s old is still in flight', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await createTenant(tx, ACME);
      const key = randomUUID();
      await reserveDirectly(tx, tenant.tenantId, key, new Date(TEST_NOW.getTime() - RESERVATION_TTL_MS + 1));
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson(apiKey, BODY, key));
      expect(res.status).toBe(409);
    });
  });

  it('stores an error response and replays it as the same error', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await createTenant(tx, ACME);
      const app = testApp(tx);
      const key = randomUUID();
      const first = await app.request(CUSTOMERS_PATH, postJson(apiKey, {}, key));
      const replay = await app.request(CUSTOMERS_PATH, postJson(apiKey, {}, key));
      expect(first.status).toBe(400);
      expect(replay.status).toBe(400);
      expect(await replay.text()).toBe(await first.text());
    });
  });

  it('reserves nothing when authentication fails', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(CUSTOMERS_PATH, postJson('not-a-real-key', BODY));
      expect(res.status).toBe(401);
      expect(await tx.$count(idempotencyKeysTable)).toBe(0);
    });
  });
});
