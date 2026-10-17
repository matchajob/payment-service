import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createPlan } from '@/lib/plans/create-plan';
import { PaymentServiceError } from '@sdk/payment-service-error';
import { testDb, withRollback } from '@tests/utils/db';
import { MONTHLY } from '@tests/utils/plan-fixtures';
import { sdkFor } from '@tests/utils/sdk-client';
import { testApp } from '@tests/utils/test-app';
import { ACME } from '@tests/utils/tenant-fixtures';
import { seedTenant } from '@tests/utils/tenant-rows';

const EXTERNAL_REF = 'user-42';

describe('SDK plans and customers, run against the real app (ADR 0015)', () => {
  it('lists the tenant plans', async () => {
    await withRollback(testDb(), async (tx) => {
      const { tenant, apiKey } = await seedTenant(tx, ACME);
      await createPlan(tx, { ...MONTHLY, tenantId: tenant.tenantId });
      const plans = await sdkFor(testApp(tx), apiKey).plans.list();
      expect(plans.map((plan) => plan.name)).toEqual([MONTHLY.name]);
    });
  });

  it('creates a customer and reads it back', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const sdk = sdkFor(testApp(tx), apiKey);
      const created = await sdk.customers.create({ externalRef: EXTERNAL_REF });
      expect(created).toEqual({ customerId: expect.any(String), externalRef: EXTERNAL_REF });
      expect(await sdk.customers.get(created.customerId)).toEqual(created);
    });
  });

  it('throws a typed 409 error carrying the problem when the customer already exists', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const sdk = sdkFor(testApp(tx), apiKey);
      await sdk.customers.create({ externalRef: EXTERNAL_REF });
      const failure = await sdk.customers.create({ externalRef: EXTERNAL_REF }).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(PaymentServiceError);
      expect(failure).toMatchObject({
        status: 409,
        problem: { status: 409, detail: expect.stringContaining(EXTERNAL_REF) },
      });
    });
  });

  it('throws a typed 404 error for an unknown customer', async () => {
    await withRollback(testDb(), async (tx) => {
      const { apiKey } = await seedTenant(tx, ACME);
      const failure = await sdkFor(testApp(tx), apiKey)
        .customers.get(randomUUID())
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(PaymentServiceError);
      expect(failure).toMatchObject({ status: 404 });
    });
  });

  it('throws a typed 401 error for an unknown API key', async () => {
    await withRollback(testDb(), async (tx) => {
      const failure = await sdkFor(testApp(tx), 'not-a-key')
        .plans.list()
        .catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(PaymentServiceError);
      expect(failure).toMatchObject({ status: 401 });
    });
  });
});
