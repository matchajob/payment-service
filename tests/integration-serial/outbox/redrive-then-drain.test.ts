import { describe, expect, it } from 'vitest';
import { DELIVERY_STATUS } from '@/lib/outbox/delivery-status';
import { drainOutbox } from '@/lib/outbox/drain-outbox';
import { redriveDeadLetters } from '@/lib/outbox/redrive-dead-letters';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/outbox/retry-schedule';
import { fakeTenantEndpoint } from '@tests/utils/fake-tenant-endpoint';
import { OCCURRED_AT } from '@tests/utils/outbox-rows';
import { outboxRow, queueEvent, receivingAt, seedReceiver } from '@tests/utils/queued-events';
import { ACME } from '@tests/utils/tenant-fixtures';
import { truncateModeDb } from '@tests/utils/truncate-mode';

const FIXED_AT = new Date(OCCURRED_AT.getTime() + 1);

describe('redrive after the receiver is fixed (Spec 5 rule 7)', () => {
  const db = truncateModeDb();

  it('delivers a redriven event on the next drain, with a full new set of attempts', async () => {
    const endpoint = await fakeTenantEndpoint();
    const receiver = await seedReceiver(db, receivingAt(endpoint, ACME));
    const dead = await queueEvent(db, receiver, 1, {
      deliveryStatus: DELIVERY_STATUS.DEAD,
      attempts: MAX_DELIVERY_ATTEMPTS,
      lastError: 'HTTP 500',
    });
    await redriveDeadLetters(db, { tenantId: receiver.tenantId }, FIXED_AT);
    expect(await drainOutbox(db, FIXED_AT)).toEqual({ processed: 1, failed: 0 });
    expect(await outboxRow(db, dead)).toMatchObject({ deliveryStatus: DELIVERY_STATUS.DELIVERED, attempts: 1 });
  });
});
