import { describe, expect, it } from 'vitest';
import { RENEWAL_BATCH_LIMIT } from '@/lib/renewal/renewal-batch-limit';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { ALWAYS_TIME_UP } from '@tests/utils/time-up-fixtures';

const NOTHING_DONE = { processed: 0, failed: 0 };
const ONE_DONE = { processed: 1, failed: 0 };

describe('runRenewal: time budget (code-review-1 M11, ADR 0026)', () => {
  it('charges nothing once time is up and leaves the subscription due for the next run (dunning shares the cycle)', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const renewing = await seedRenewing(tx);
      const provider = providers.providerOf(renewing.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      expect(await renewWith(tx, providers.providerFor, RENEWAL_BATCH_LIMIT, ALWAYS_TIME_UP)(PERIOD_END)).toEqual(
        NOTHING_DONE,
      );
      expect(provider.calls.charge).toEqual([]);
      expect(await renewWith(tx, providers.providerFor)(PERIOD_END)).toEqual(ONE_DONE);
    });
  });
});
