import { describe, expect, it } from 'vitest';
import { testDb, withRollback } from '@tests/utils/db';
import { fakeProviderFactory } from '@tests/utils/fake-provider-factory';
import { seedPendingRenewals } from '@tests/utils/pending-charge-rows';
import { chargesOf } from '@tests/utils/renewal-reads';
import { NEXT_PERIOD_END, PERIOD_END, seedRenewing } from '@tests/utils/renewal-rows';
import { renewWith } from '@tests/utils/renewal-run';
import { RENEWAL_SUCCEEDED } from '@tests/utils/renewal-charge-fixtures';

const CHARGES = 3;
const LARGEST_GROW_IDENTIFIER = 4294967295n;

describe('charges.chargeSerial: a per-attempt integer for providers whose idempotency key is a number (grow skill, transactionUniqueIdentifier)', () => {
  it('gives every charge row its own positive serial, within the range Grow accepts', async () => {
    await withRollback(testDb(), async (tx) => {
      const serials = (await seedPendingRenewals(tx, CHARGES)).map(({ charge }) => charge.chargeSerial);
      expect(new Set(serials).size).toBe(CHARGES);
      for (const serial of serials) {
        expect(serial).toBeGreaterThan(0n);
        expect(serial).toBeLessThanOrEqual(LARGEST_GROW_IDENTIFIER);
      }
    });
  });

  it('sends the provider the serial of the charge row the attempt wrote before calling it (ADR 0008)', async () => {
    await withRollback(testDb(), async (tx) => {
      const providers = fakeProviderFactory();
      const renewing = await seedRenewing(tx);
      const provider = providers.providerOf(renewing.ctx.providerConnectionId);
      provider.scriptCharge(RENEWAL_SUCCEEDED);

      await renewWith(tx, providers.providerFor)(PERIOD_END);

      const charges = await chargesOf(tx, renewing.subscription.subscriptionId);
      const charge = charges.find(({ periodEnd }) => periodEnd.getTime() === NEXT_PERIOD_END.getTime());
      if (charge === undefined) throw new Error('renewal wrote no charge row');
      expect(provider.calls.charge).toEqual([expect.objectContaining({ chargeSerial: charge.chargeSerial })]);
    });
  });
});
