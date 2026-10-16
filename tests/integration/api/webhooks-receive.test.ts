import { describe, expect, it } from 'vitest';
import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { seedConnection } from '@tests/utils/connection-rows';
import { testDb, withRollback } from '@tests/utils/db';
import { everyConnection } from '@tests/utils/fake-provider-factory';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { TEST_NOW, testApp } from '@tests/utils/test-app';

const GARBAGE = 'definitely not a provider payload';
const UNKNOWN_PROVIDER = 'stripe';
const UNKNOWN_CONNECTION = '7d1c6a1e-2f3b-4c5d-8e9f-0a1b2c3d4e5f';
const NOT_A_UUID = 'acme';
const crashingProviders = everyConnection(unconfiguredProvider);

describe('POST /v1/webhooks/:provider/:providerConnectionId (Spec 4, ADR 0010 decision 4)', () => {
  it('needs no API key and no Idempotency-Key, because providers send neither', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      const res = await testApp(tx).request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      expect(res.status).toBe(200);
    });
  });

  it('stores the raw body against its connection, untrusted, at the injected time (rule 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      await testApp(tx).request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      const rows = await tx.select().from(webhookEventsTable);
      expect(rows).toEqual([
        expect.objectContaining({ providerConnectionId, rawBody: GARBAGE, trusted: false, receivedAt: TEST_NOW }),
      ]);
    });
  });

  it('stores a replayed payload once and answers 200 both times (rule 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      const app = testApp(tx);
      const first = await app.request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      const replay = await app.request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      expect([first.status, replay.status]).toEqual([200, 200]);
      expect(await tx.$count(webhookEventsTable)).toBe(1);
    });
  });

  it('stores the same payload once per connection, since two merchant accounts can send identical bodies', async () => {
    await withRollback(testDb(), async (tx) => {
      const first = await seedConnection(tx);
      const second = await seedConnection(tx);
      const app = testApp(tx);
      await app.request(webhookPath(first.providerConnectionId), postWebhook(GARBAGE));
      await app.request(webhookPath(second.providerConnectionId), postWebhook(GARBAGE));
      expect(await tx.$count(webhookEventsTable)).toBe(2);
    });
  });

  it('acknowledges an unrecognized payload with 200 and marks it processed, since a retry helps nothing (rule 6)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      await testApp(tx).request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      const [row] = await tx.select().from(webhookEventsTable);
      expect(row?.processedAt).toEqual(TEST_NOW);
    });
  });

  it('keeps the stored event unprocessed and answers 5xx when interpreting fails, so the provider retries (rules 1 and 6)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      const res = await testApp(tx, { providerFor: crashingProviders }).request(
        webhookPath(providerConnectionId),
        postWebhook(GARBAGE),
      );
      expect(res.status).toBe(500);
      const [row] = await tx.select().from(webhookEventsTable);
      expect(row).toMatchObject({ rawBody: GARBAGE, processedAt: null });
    });
  });

  it('interprets a retried payload again when the first attempt crashed, instead of swallowing the retry', async () => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      await testApp(tx, { providerFor: crashingProviders }).request(
        webhookPath(providerConnectionId),
        postWebhook(GARBAGE),
      );
      const retry = await testApp(tx).request(webhookPath(providerConnectionId), postWebhook(GARBAGE));
      expect(retry.status).toBe(200);
      const rows = await tx.select().from(webhookEventsTable);
      expect(rows).toEqual([expect.objectContaining({ processedAt: TEST_NOW })]);
    });
  });

  it.each([
    ['an unknown provider', (connectionId: string) => webhookPath(connectionId, UNKNOWN_PROVIDER)],
    ['an unknown connection', () => webhookPath(UNKNOWN_CONNECTION)],
    ['a connection id that is not a UUID, such as the old tenant slug', () => webhookPath(NOT_A_UUID)],
  ])('answers 404 for %s and stores nothing', async (_, path) => {
    await withRollback(testDb(), async (tx) => {
      const { providerConnectionId } = await seedConnection(tx);
      const res = await testApp(tx).request(path(providerConnectionId), postWebhook(GARBAGE));
      expect(res.status).toBe(404);
      expect(await tx.$count(webhookEventsTable)).toBe(0);
    });
  });
});
