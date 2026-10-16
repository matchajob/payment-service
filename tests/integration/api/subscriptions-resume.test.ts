import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { problemSchema } from '@/contract/problem';
import { subscriptionResponseSchema } from '@/contract/subscription-response';
import type { Database } from '@/lib/db';
import { REJECTION_REASON } from '@/lib/subscriptions/state-machine/rejection-reason';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { tenantsTable } from '@/lib/tenants/schema';
import { testDb, withRollback } from '@tests/utils/db';
import { seedPastDue } from '@tests/utils/dunning-rows';
import { subscriptionRow } from '@tests/utils/renewal-reads';
import { PERIOD_END, seedRenewing, type Renewing } from '@tests/utils/renewal-rows';
import { postNoBody, resumePath } from '@tests/utils/subscription-api';
import { testApp } from '@tests/utils/test-app';

const FLAGGED = { cancelAtPeriodEnd: true };
const INCOMPLETE = { status: SUBSCRIPTION_STATUS.INCOMPLETE, currentPeriodEnd: null, anchorDay: null };

const resume = (tx: Database, { ctx, subscription }: Renewing) =>
  testApp(tx).request(resumePath(subscription.subscriptionId), postNoBody(ctx.apiKey));

describe('POST /v1/subscriptions/:id/resume (S1 r9, D2)', () => {
  it('r9: clears the flag and keeps the period', async () => {
    await withRollback(testDb(), async (tx) => {
      const flagged = await seedRenewing(tx, FLAGGED);
      const res = await resume(tx, flagged);
      expect(res.status).toBe(200);
      expect(subscriptionResponseSchema.parse(await res.json()).data).toMatchObject({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: PERIOD_END.toISOString(),
      });
    });
  });

  it("answers 409 with resume_not_allowed when the tenant's policy forbids it, and keeps the flag", async () => {
    await withRollback(testDb(), async (tx) => {
      const flagged = await seedRenewing(tx, FLAGGED);
      await tx
        .update(tenantsTable)
        .set({ resumeAllowed: false })
        .where(eq(tenantsTable.tenantId, flagged.ctx.tenantId));
      const res = await resume(tx, flagged);
      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.RESUME_NOT_ALLOWED);
      expect(await subscriptionRow(tx, flagged.subscription.subscriptionId)).toMatchObject({ cancelAtPeriodEnd: true });
    });
  });

  it('D2: answers 200 and changes nothing for an active subscription that was never flagged', async () => {
    await withRollback(testDb(), async (tx) => {
      const active = await seedRenewing(tx);
      const res = await resume(tx, active);
      expect(res.status).toBe(200);
      expect(await subscriptionRow(tx, active.subscription.subscriptionId)).toMatchObject({
        cancelAtPeriodEnd: false,
        sequence: active.subscription.sequence,
      });
    });
  });

  it.each([
    ['past_due', (db: Database) => seedPastDue(db)],
    ['incomplete', (db: Database) => seedRenewing(db, INCOMPLETE)],
    ['canceled', (db: Database) => seedRenewing(db, { status: SUBSCRIPTION_STATUS.CANCELED })],
  ])('answers 409 for a %s subscription', async (_, seed) => {
    await withRollback(testDb(), async (tx) => {
      const res = await resume(tx, await seed(tx));
      expect(res.status).toBe(409);
      expect(problemSchema.parse(await res.json()).detail).toBe(REJECTION_REASON.NOT_ACCEPTED_IN_STATE);
    });
  });
});
