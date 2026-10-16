import { describe, expect, it } from 'vitest';
import type { Database } from '@/lib/db';
import { SCHEDULE_OWNER } from '@/lib/subscriptions/state-machine/schedule-owner';
import { SUBSCRIPTION_STATUS } from '@/lib/subscriptions/state-machine/subscription-status';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';

const ONE_MS = 1;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const NOTHING_DONE = { processed: 0, failed: 0 };

const setup = async (tx: Database, overrides: Parameters<typeof seedRenewing>[1] = {}) => {
  const providers = fakeProviderFactory();
  const renewing = await seedRenewing(tx, overrides);
  const provider = providers.providerOf(renewing.ctx.providerConnectionId);
  provider.scriptCharge(RENEWAL_SUCCEEDED);
  return { provider, renew: renewWith(tx, providers.providerFor) };
};

describe('runRenewal: due detection (Spec 2, S1 r5)', () => {
  it('does not charge a subscription whose period ends after now', async () => {
    await withRollback(testDb(), async (tx) => {
      const { provider, renew } = await setup(tx);
      expect(await renew(new Date(PERIOD_END.getTime() - ONE_MS))).toEqual(NOTHING_DONE);
      expect(provider.calls.charge).toEqual([]);
    });
  });

  it('charges a subscription whose period ended exactly now', async () => {
    await withRollback(testDb(), async (tx) => {
      const { provider, renew } = await setup(tx);
      expect(await renew(PERIOD_END)).toEqual({ processed: 1, failed: 0 });
      expect(provider.calls.charge).toHaveLength(1);
    });
  });

  it.each([
    ['a past_due', { status: SUBSCRIPTION_STATUS.PAST_DUE }],
    ['a canceled', { status: SUBSCRIPTION_STATUS.CANCELED, canceledAt: PERIOD_END }],
    ['an incomplete', { status: SUBSCRIPTION_STATUS.INCOMPLETE, currentPeriodEnd: null, anchorDay: null }],
    ['a store-billed', { scheduleOwner: SCHEDULE_OWNER.EXTERNAL }],
  ])('ignores %s subscription', async (_, overrides) => {
    await withRollback(testDb(), async (tx) => {
      const { provider, renew } = await setup(tx, overrides);
      expect(await renew(new Date(PERIOD_END.getTime() + ONE_DAY_MS))).toEqual(NOTHING_DONE);
      expect(provider.calls.charge).toEqual([]);
    });
  });
});
