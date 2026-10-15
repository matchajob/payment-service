import { afterAll, describe, expect, it } from 'vitest';
import { outboxEventsTable } from '@/lib/outbox/schema';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { createTenant } from '@/lib/tenants/create-tenant';
import { tenantsTable } from '@/lib/tenants/schema';
import { testDb } from '@tests/utils/db';
import { insertOutboxEvent } from '@tests/utils/outbox-rows';
import { seedSubscriptionOwner } from '@tests/utils/payment-method-rows';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateAll } from '@tests/utils/truncate';
import { truncateModeDb } from '@tests/utils/truncate-mode';

describe('truncate mode (ADR 0003 mode b)', () => {
  const db = truncateModeDb();
  const otherConnection = testDb();
  afterAll(() => otherConnection.$client.end());

  it('makes a commit on one connection visible to another, which rollback mode cannot', async () => {
    await createTenant(db, ACME);
    expect(await otherConnection.$count(tenantsTable)).toBe(1);
  });

  it('starts each test with empty tables, so the previous test leaves nothing behind', async () => {
    expect(await db.$count(tenantsTable)).toBe(0);
  });

  it('empties every table, including ones only reachable through foreign keys', async () => {
    const owner = await seedSubscriptionOwner(db);
    await insertOutboxEvent(db, owner, 1);
    await truncateAll(db);
    expect(await db.$count(tenantsTable)).toBe(0);
    expect(await db.$count(subscriptionsTable)).toBe(0);
    expect(await db.$count(outboxEventsTable)).toBe(0);
  });
});
