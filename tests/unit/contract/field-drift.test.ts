import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import { randomUUID } from 'node:crypto';
import { createCustomerRequestSchema } from '@/contract/create-customer-request';
import { createSubscriptionRequestSchema } from '@/contract/create-subscription-request';
import { publicPlanSchema } from '@/contract/public-plan';
import { zCustomerCreate } from '@/lib/customers/schema';
import { zPlanCreate } from '@/lib/plans/schema';
import { zSubscriptionRead } from '@/lib/subscriptions/schema';

const COLUMN_MAX_LENGTH = 64;

const verdicts = (schema: ZodType, inputs: readonly unknown[]) =>
  inputs.map((input) => schema.safeParse(input).success);

const STRING_BOUNDARIES = ['', 'a', 'a'.repeat(COLUMN_MAX_LENGTH), 'a'.repeat(COLUMN_MAX_LENGTH + 1)];
const NULLABLE_STRING_BOUNDARIES = [...STRING_BOUNDARIES, null, undefined];
const EMAIL_MAX_LENGTH = 254;
const EMAIL_DOMAIN = '@x.co';
const EMAIL_BOUNDARIES = [
  'a@b.co',
  'not-an-email',
  '',
  null,
  undefined,
  `${'a'.repeat(EMAIL_MAX_LENGTH - EMAIL_DOMAIN.length)}${EMAIL_DOMAIN}`,
  `${'a'.repeat(EMAIL_MAX_LENGTH - EMAIL_DOMAIN.length + 1)}${EMAIL_DOMAIN}`,
];
const AMOUNT_BOUNDARIES = [-1, 0, 1, 1.5, 4900];
const UUID_BOUNDARIES = [
  randomUUID(),
  randomUUID().toUpperCase(),
  '00000000-0000-0000-0000-000000000000',
  'not-a-uuid',
  '',
];

describe('contract fields accept and reject exactly what the columns do', () => {
  it('customer externalRef', () => {
    expect(verdicts(createCustomerRequestSchema.shape.externalRef, STRING_BOUNDARIES)).toEqual(
      verdicts(zCustomerCreate.shape.externalRef, STRING_BOUNDARIES),
    );
  });

  it.each(['name', 'taxId'] as const)('customer %s', (field) => {
    expect(verdicts(createCustomerRequestSchema.shape[field], NULLABLE_STRING_BOUNDARIES)).toEqual(
      verdicts(zCustomerCreate.shape[field], NULLABLE_STRING_BOUNDARIES),
    );
  });

  it('customer email', () => {
    expect(verdicts(createCustomerRequestSchema.shape.email, EMAIL_BOUNDARIES)).toEqual(
      verdicts(zCustomerCreate.shape.email, EMAIL_BOUNDARIES),
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

  it.each(['customerId', 'planId'] as const)('subscription request %s', (field) => {
    expect(verdicts(createSubscriptionRequestSchema.shape[field], UUID_BOUNDARIES)).toEqual(
      verdicts(zSubscriptionRead.shape[field], UUID_BOUNDARIES),
    );
  });
});
