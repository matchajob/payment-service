import { afterAll, describe, expect, it } from 'vitest';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { testDb } from '@tests/utils/db';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const NOW = OCCURRED_AT;
const EVENT_COUNT = 20;

describe('drainOutbox: concurrency (Spec 5 rule 2, ADR 0002 double-fire)', () => {
  const db = truncateModeDb();
  const secondInstance = testDb();
  afterAll(() => secondInstance.$client.end());

  it('two drainers running at once on separate connections deliver each event exactly once', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const sequences = Array.from({ length: EVENT_COUNT }, (_, index) => index + 1);
    const events = await Promise.all(sequences.map((sequence) => queueEvent(db, receiver, sequence)));

    const [first, second] = await Promise.all([drainOutbox(db, NOW), drainOutbox(secondInstance, NOW)]);

    const deliveredIds = endpoint.deliveries.map(({ body }) => JSON.parse(body).eventId);
    expect((first?.processed ?? 0) + (second?.processed ?? 0)).toBe(EVENT_COUNT);
    expect(deliveredIds).toHaveLength(EVENT_COUNT);
    expect(new Set(deliveredIds)).toEqual(new Set(events.map(({ outboxEventId }) => outboxEventId)));
  });
});
