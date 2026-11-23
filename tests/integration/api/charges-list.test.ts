import { describe, expect, it } from 'vitest';
import { chargeListResponseSchema } from '@/contract/charge-list-response';
import { CHARGE_KIND } from '@/lib/charges/charge-kind';
import { CHARGE_STATUS } from '@/lib/charges/charge-status';
import { bearer } from '@tests/utils/bearer';
import { insertCycleCharge } from '@tests/utils/cycle-charge-insert';
import { testDb, withRollback } from '@tests/utils/db';
import { withQuery } from '@tests/utils/list-query';
import { CHARGES_PATH } from '@tests/utils/paths';
import { RENEWAL, RENEWAL_ATTEMPTED_AT } from '@tests/utils/pending-charge-shapes';
import { seedRenewing } from '@tests/utils/renewal-rows';
import { testApp } from '@tests/utils/test-app';
import { GLOBEX } from '@tests/utils/tenant-fixtures';

const DECLINE = 'card declined';
const UNKNOWN_STATUS = 'refunded';

type Page = { data: { chargeId: string; status: string }[]; hasMore: boolean };

describe('GET /v1/charges (dashboard slice 1)', () => {
  it("lists the calling tenant's charges newest first, with the provider's decline reason", async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      const failed = await insertCycleCharge(tx, renewing, RENEWAL, {
        status: CHARGE_STATUS.FAILED,
        failureReason: DECLINE,
      });
      const res = await testApp(tx).request(CHARGES_PATH, bearer(renewing.ctx.apiKey));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(chargeListResponseSchema.parse(body)).toEqual(body);
      expect(body).toEqual({
        hasMore: false,
        data: [
          {
            chargeId: failed.chargeId,
            subscriptionId: renewing.subscription.subscriptionId,
            kind: CHARGE_KIND.RENEWAL,
            amountMinor: renewing.ctx.plan.amountMinor,
            currency: renewing.ctx.plan.currency,
            status: CHARGE_STATUS.FAILED,
            failureReason: DECLINE,
            attemptedAt: RENEWAL_ATTEMPTED_AT.toISOString(),
          },
          expect.objectContaining({ chargeId: renewing.history[0]?.chargeId, status: CHARGE_STATUS.SUCCEEDED }),
        ],
      });
    });
  });

  it('filters by status, so the dashboard can show failed charges only', async () => {
    await withRollback(testDb(), async (tx) => {
      const renewing = await seedRenewing(tx);
      const failed = await insertCycleCharge(tx, renewing, RENEWAL, {
        status: CHARGE_STATUS.FAILED,
        failureReason: DECLINE,
      });
      const res = await testApp(tx).request(
        withQuery(CHARGES_PATH, { status: CHARGE_STATUS.FAILED }),
        bearer(renewing.ctx.apiKey),
      );
      const body: Page = await res.json();
      expect(body.data.map((c) => c.chargeId)).toEqual([failed.chargeId]);
    });
  });

  it("never shows another tenant's charges", async () => {
    await withRollback(testDb(), async (tx) => {
      await seedRenewing(tx);
      const ours = await seedRenewing(tx, {}, GLOBEX);
      const body: Page = await (await testApp(tx).request(CHARGES_PATH, bearer(ours.ctx.apiKey))).json();
      expect(body.data.map((c) => c.chargeId)).toEqual(ours.history.map((c) => c.chargeId));
    });
  });

  it('answers 400 for an unknown status', async () => {
    await withRollback(testDb(), async (tx) => {
      const { ctx } = await seedRenewing(tx);
      const res = await testApp(tx).request(withQuery(CHARGES_PATH, { status: UNKNOWN_STATUS }), bearer(ctx.apiKey));
      expect(res.status).toBe(400);
    });
  });
});
