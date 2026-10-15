import { describe, expect, it } from 'vitest';
import { unconfiguredProvider } from '@/lib/payments/unconfigured-provider';
import { createTenant } from '@/lib/tenants/create-tenant';
import { webhookEventsTable } from '@/lib/webhooks/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { postWebhook, webhookPath } from '@tests/utils/post-webhook';
import { TEST_NOW, testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';

const GARBAGE = 'definitely not a provider payload';
const UNKNOWN_PROVIDER = 'stripe';
const UNKNOWN_SLUG = 'no-such-tenant';

describe('POST /v1/webhooks/:provider/:tenantSlug (Spec 4)', () => {
  it('needs no API key and no Idempotency-Key, because providers send neither', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      const res = await testApp(tx).request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      expect(res.status).toBe(200);
    });
  });

  it('stores the raw body, untrusted, at the injected time (rule 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant } = await createTenant(tx, ACME);
      await testApp(tx).request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      const rows = await tx.select().from(webhookEventsTable);
      expect(rows).toEqual([
        expect.objectContaining({ tenantId: tenant.tenantId, rawBody: GARBAGE, trusted: false, receivedAt: TEST_NOW }),
      ]);
    });
  });

  it('stores a replayed payload once and answers 200 both times (rule 1)', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      const app = testApp(tx);
      const first = await app.request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      const replay = await app.request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      expect([first.status, replay.status]).toEqual([200, 200]);
      expect(await tx.$count(webhookEventsTable)).toBe(1);
    });
  });

  it('acknowledges an unrecognized payload with 200 and marks it processed, since a retry helps nothing (rule 6)', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      await testApp(tx).request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      const [row] = await tx.select().from(webhookEventsTable);
      expect(row?.processedAt).toEqual(TEST_NOW);
    });
  });

  it('keeps the stored event unprocessed and answers 5xx when interpreting fails, so the provider retries (rules 1 and 6)', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      const res = await testApp(tx, { provider: unconfiguredProvider }).request(
        webhookPath(ACME.slug),
        postWebhook(GARBAGE),
      );
      expect(res.status).toBe(500);
      const [row] = await tx.select().from(webhookEventsTable);
      expect(row).toMatchObject({ rawBody: GARBAGE, processedAt: null });
    });
  });

  it('interprets a retried payload again when the first attempt crashed, instead of swallowing the retry', async () => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      await testApp(tx, { provider: unconfiguredProvider }).request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      const retry = await testApp(tx).request(webhookPath(ACME.slug), postWebhook(GARBAGE));
      expect(retry.status).toBe(200);
      const rows = await tx.select().from(webhookEventsTable);
      expect(rows).toEqual([expect.objectContaining({ processedAt: TEST_NOW })]);
    });
  });

  it.each([
    ['an unknown provider', () => webhookPath(ACME.slug, UNKNOWN_PROVIDER)],
    ['an unknown tenant slug', () => webhookPath(UNKNOWN_SLUG)],
  ])('answers 404 for %s and stores nothing', async (_, path) => {
    await withRollback(testDb(), async (tx) => {
      await createTenant(tx, ACME);
      const res = await testApp(tx).request(path(), postWebhook(GARBAGE));
      expect(res.status).toBe(404);
      expect(await tx.$count(webhookEventsTable)).toBe(0);
    });
  });
});
