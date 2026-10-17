import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createClient } from '@sdk/create-client';
import { testDb, withRollback } from '@tests/utils/db';
import { fetchInto, recordingFetch, SDK_BASE_URL } from '@tests/utils/sdk-client';
import { testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const IDEMPOTENCY_HEADER = 'idempotency-key';
const FIRST_REF = 'user-1';
const SECOND_REF = 'user-2';
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('SDK idempotency keys (spec idempotency, ADR 0006)', () => {
  it('generates a fresh UUID key for each mutating call that names none', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const { fetch, calls } = recordingFetch(fetchInto(testApp(tx)));
      const sdk = createClient({ baseUrl: SDK_BASE_URL, apiKey, fetch });

      await sdk.customers.create({ externalRef: FIRST_REF });
      await sdk.customers.create({ externalRef: SECOND_REF });

      const keys = calls.map((call) => call.init.headers[IDEMPOTENCY_HEADER]);
      expect(keys).toEqual([expect.stringMatching(UUID_SHAPE), expect.stringMatching(UUID_SHAPE)]);
      expect(keys[0]).not.toBe(keys[1]);
    });
  });

  it('sends the key it is given, and sends none on a read', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const { fetch, calls } = recordingFetch(fetchInto(testApp(tx)));
      const sdk = createClient({ baseUrl: SDK_BASE_URL, apiKey, fetch });
      const key = randomUUID();

      await sdk.customers.create({ externalRef: FIRST_REF }, { idempotencyKey: key });
      await sdk.plans.list();

      expect(calls[0]?.init.headers[IDEMPOTENCY_HEADER]).toBe(key);
      expect(calls[1]?.init.headers).not.toHaveProperty(IDEMPOTENCY_HEADER);
    });
  });

  it('replays the first answer when a call is retried with the same key, instead of failing with 409', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const sdk = createClient({ baseUrl: SDK_BASE_URL, apiKey, fetch: fetchInto(testApp(tx)) });
      const key = randomUUID();

      const first = await sdk.customers.create({ externalRef: FIRST_REF }, { idempotencyKey: key });
      const retry = await sdk.customers.create({ externalRef: FIRST_REF }, { idempotencyKey: key });

      expect(retry).toEqual(first);
    });
  });

  it('throws a typed 422 error when a key is reused with a different body', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const sdk = createClient({ baseUrl: SDK_BASE_URL, apiKey, fetch: fetchInto(testApp(tx)) });
      const key = randomUUID();

      await sdk.customers.create({ externalRef: FIRST_REF }, { idempotencyKey: key });
      const failure = await sdk.customers
        .create({ externalRef: SECOND_REF }, { idempotencyKey: key })
        .catch((error: unknown) => error);

      expect(failure).toMatchObject({ status: 422 });
    });
  });
});
