import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { createCustomerRequestSchema } from '@/contract/create-customer-request';
import { publicPlanSchema } from '@/contract/public-plan';
import { zCustomerCreate } from '@/lib/customers/schema';
import { zPlanCreate } from '@/lib/plans/schema';

const COLUMN_MAX_LENGTH = 64;

const verdicts = (schema: ZodType, inputs: readonly unknown[]) =>
  inputs.map((input) => schema.safeParse(input).success);

const STRING_BOUNDARIES = ['', 'a', 'a'.repeat(COLUMN_MAX_LENGTH), 'a'.repeat(COLUMN_MAX_LENGTH + 1)];
const AMOUNT_BOUNDARIES = [-1, 0, 1, 1.5, 4900];

describe('contract fields accept and reject exactly what the columns do', () => {
  it('customer externalRef', () => {
    expect(verdicts(createCustomerRequestSchema.shape.externalRef, STRING_BOUNDARIES)).toEqual(
      verdicts(zCustomerCreate.shape.externalRef, STRING_BOUNDARIES),
    );
  });

  it('plan name', () => {
    expect(verdicts(publicPlanSchema.shape.name, STRING_BOUNDARIES)).toEqual(
      verdicts(zPlanCreate.shape.name, STRING_BOUNDARIES),
    );
  });

  it('plan amountMinor', () => {
    expect(verdicts(publicPlanSchema.shape.amountMinor, AMOUNT_BOUNDARIES)).toEqual(
      verdicts(zPlanCreate.shape.amountMinor, AMOUNT_BOUNDARIES),
    );
  });
});
