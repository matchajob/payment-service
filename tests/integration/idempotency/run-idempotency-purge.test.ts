import { describe, expect, it } from 'vitest';
import { COMPLETED_KEY_TTL_MS } from '@/lib/idempotency/completed-key-ttl';
import { runIdempotencyPurge } from '@/lib/idempotency/run-idempotency-purge';
import { idempotencyKeysTable } from '@/lib/idempotency/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { insertCompletedKey, insertReservedKey } from '@tests/utils/idempotency-rows';
import { TEST_NOW } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const ago = (ms: number) => new Date(TEST_NOW.getTime() - ms);

describe('runIdempotencyPurge (rule 6, D10)', () => {
  it('deletes completed keys older than 24h and counts them', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      await insertCompletedKey(tx, tenant.tenantId, ago(COMPLETED_KEY_TTL_MS + 1));
      await insertCompletedKey(tx, tenant.tenantId, ago(COMPLETED_KEY_TTL_MS + 1));
      expect(await runIdempotencyPurge(tx, TEST_NOW)).toEqual({ processed: 2, failed: 0 });
      expect(await tx.$count(idempotencyKeysTable)).toBe(0);
    });
  });

  it('keeps a completed key exactly 24h old', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      await insertCompletedKey(tx, tenant.tenantId, ago(COMPLETED_KEY_TTL_MS));
      expect(await runIdempotencyPurge(tx, TEST_NOW)).toEqual({ processed: 0, failed: 0 });
      expect(await tx.$count(idempotencyKeysTable)).toBe(1);
    });
  });

  it('never deletes a reservation, however old', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await seedTenant(tx, ACME);
      await insertReservedKey(tx, tenant.tenantId, ago(COMPLETED_KEY_TTL_MS * 10));
      expect(await runIdempotencyPurge(tx, TEST_NOW)).toEqual({ processed: 0, failed: 0 });
      expect(await tx.$count(idempotencyKeysTable)).toBe(1);
    });
  });
});
