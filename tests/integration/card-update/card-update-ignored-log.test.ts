import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CANCEL_REASON } from '@/lib/subscriptions/cancel-reason';
import { subscriptionsTable } from '@/lib/subscriptions/schema';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { CHECKOUT_COMPLETION_IGNORED } from '@/lib/webhooks/checkout-completion-ignored';
import { IGNORED_REASON } from '@/lib/webhooks/ignored-reason';
import { capturingLogger } from '@tests/utils/capturing-logger';
import { cardUpdateFlow } from '@tests/utils/card-update-flow';
import { testDb, withRollback } from '@tests/utils/db';
import { ignoredLines } from '@tests/utils/ignored-log-lines';
import { PINO_LEVEL } from '@tests/utils/pino-levels';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const UPDATED_AT = new Date('2026-02-01T10:00:00.000Z');

describe('an ignored card update is logged (ADR 0018, code-review-1 M23)', () => {
  it('logs a completion that names another subscription than the one that asked', async () => {
    await withRollback(testDb(), async (tx) => {
      const log = capturingLogger();
      const active = await seedRenewing(tx);
      const other = await seedRenewing(tx, {}, GLOBEX);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT, log.logger);
      const sessionRef = await flow.start();

      await flow.complete(sessionRef, other.subscription.subscriptionId);

      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({
          level: PINO_LEVEL.WARN,
          msg: CHECKOUT_COMPLETION_IGNORED,
          reason: IGNORED_REASON.CARD_UPDATE_IGNORED,
          subscriptionId: active.subscription.subscriptionId,
          reference: other.subscription.subscriptionId,
        }),
      ]);
    });
  });

  it('logs a card update for a subscription canceled before the customer finished', async () => {
    await withRollback(testDb(), async (tx) => {
      const log = capturingLogger();
      const active = await seedRenewing(tx);
      const flow = cardUpdateFlow(tx, active, UPDATED_AT, log.logger);
      const sessionRef = await flow.start();
      await tx
        .update(subscriptionsTable)
        .set({
          status: SUBSCRIPTION_STATUS.CANCELED,
          canceledAt: UPDATED_AT,
          cancelReason: CANCEL_REASON.CUSTOMER_REQUEST,
        })
        .where(eq(subscriptionsTable.subscriptionId, active.subscription.subscriptionId));
      await flow.complete(sessionRef);

      expect(ignoredLines(log)).toEqual([
        expect.objectContaining({
          reason: IGNORED_REASON.CARD_UPDATE_IGNORED,
          subscriptionId: active.subscription.subscriptionId,
        }),
      ]);
    });
  });
});
