import { describe, expect, it } from 'vitest';
import { RECONCILE_BATCH_LIMIT } from '@/lib/reconcile/reconcile-batch-limit';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { seedPendingRenewal } from '@tests/utils/pending-charge-rows';
import { reconcileWith } from '@tests/utils/reconcile-run';
import { after, HOUR_MS } from '@tests/utils/reconcile-times';
import { silentLogger } from '@tests/utils/silent-logger';
import { ALWAYS_TIME_UP } from '@tests/utils/time-up-fixtures';
import { VERIFIED_SUCCEEDED } from '@tests/utils/verified-charge-fixtures';

const ATTEMPTED_AT = new Date('2026-01-15T10:00:00.000Z');
const NOW = after(ATTEMPTED_AT, HOUR_MS);

describe('runReconcile: time budget (code-review-1 M11, ADR 0026)', () => {
  it('asks the provider nothing once time is up and leaves the charge for the next run', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const pending = await seedPendingRenewal(tx, { attemptedAt: ATTEMPTED_AT });
      const provider = providers.providerOf(pending.ctx.providerConnectionId);
      provider.scriptVerify(VERIFIED_SUCCEEDED);

      expect(
        await reconcileWith(tx, providers.providerFor, silentLogger, RECONCILE_BATCH_LIMIT, ALWAYS_TIME_UP)(NOW),
      ).toEqual({ processed: 0, failed: 0, flagged: 0 });
      expect(provider.calls.verifyCharge).toEqual([]);
      expect(await reconcileWith(tx, providers.providerFor)(NOW)).toEqual({ processed: 1, failed: 0, flagged: 0 });
    });
  });
});
