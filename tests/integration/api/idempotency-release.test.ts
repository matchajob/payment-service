import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCustomer } from '@/lib/customers/create-customer';
import { customersTable } from '@/lib/customers/schema';
import type { Database } from '@/lib/db';
import { idempotencyKeysTable } from '@/lib/idempotency/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { postJson } from '@tests/utils/post-json';
import { testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const WRITES_THEN_THROWS_PATH = '/v1/writes-then-throws';

const writesThenThrows = (db: Database) => {
  const app = testApp(db);
  app.post(WRITES_THEN_THROWS_PATH, async (c) => {
    await createCustomer(c.get('db'), c.get('tenant').tenantId, 'half-done');
    throw new Error('handler failed after writing');
  });
  return app;
};

describe('a handler that throws', () => {
  it("rolls back the handler's writes and releases the key", async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await writesThenThrows(tx).request(WRITES_THEN_THROWS_PATH, postJson(apiKey, {}));
      expect(res.status).toBe(500);
      expect(await tx.$count(customersTable)).toBe(0);
      expect(await tx.$count(idempotencyKeysTable)).toBe(0);
    });
  });

  it('lets a retry with the same key execute again instead of replaying the 500', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const app = writesThenThrows(tx);
      const key = randomUUID();
      await app.request(WRITES_THEN_THROWS_PATH, postJson(apiKey, {}, key));
      const retry = await app.request(WRITES_THEN_THROWS_PATH, postJson(apiKey, {}, key));
      expect(retry.status).toBe(500);
      expect(await tx.$count(idempotencyKeysTable)).toBe(0);
    });
  });
});
