import { describe, expect, it } from 'vitest';
import type { CronTokenVerifier } from '@/api/cron-token-verifier';
import { problemSchema } from '@/contract/problem';
import { bearer } from '@tests/utils/bearer';
import { testDb, withRollback } from '@tests/utils/db';
import { TEST_CRON_TOKEN } from '@tests/utils/fake-cron-token-verifier';
import { PURGE_IDEMPOTENCY_PATH } from '@tests/utils/paths';
import { testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const post = (init: RequestInit = {}): RequestInit => ({ ...init, method: 'POST' });

describe('cron authentication (ADR 0012)', () => {
  it('rejects a cron call with no token with 401 problem+json', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post());
      expect(res.status).toBe(401);
      expect(problemSchema.parse(await res.json()).status).toBe(401);
    });
  });

  it('rejects a token the verifier refuses with 401', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(`${TEST_CRON_TOKEN}-forged`)));
      expect(res.status).toBe(401);
    });
  });

  it("does not accept a tenant's API key", async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(apiKey)));
      expect(res.status).toBe(401);
    });
  });

  it('accepts a token the verifier accepts', async () => {
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx).request(PURGE_IDEMPOTENCY_PATH, post(bearer(TEST_CRON_TOKEN)));
      expect(res.status).toBe(200);
    });
  });

  it('answers 500, not 401, when the verifier cannot reach Google, so Scheduler records a failed run', async () => {
    const unreachable: CronTokenVerifier = async () => {
      throw new Error('Google certs unreachable');
    };
    await withRollback(testDb(), async (tx) => {
      const res = await testApp(tx, { verifyCronToken: unreachable }).request(
        PURGE_IDEMPOTENCY_PATH,
        post(bearer(TEST_CRON_TOKEN)),
      );
      expect(res.status).toBe(500);
    });
  });
});
