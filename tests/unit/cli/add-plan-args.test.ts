import { describe, expect, it } from 'vitest';
import { readAddPlanArgs } from '@/cli/add-plan-args';

const VALID = [
  '--slug',
  'acme',
  '--plan-name',
  'Pro yearly',
  '--amount-minor',
  '49000',
  '--currency',
  'ILS',
  '--interval',
  'month',
];

const withFlag = (flag: string, value: string) => {
  const args = [...VALID];
  args[args.indexOf(flag) + 1] = value;
  return args;
};

const withoutFlag = (flag: string) => {
  const at = VALID.indexOf(flag);
  return [...VALID.slice(0, at), ...VALID.slice(at + 2)];
};

describe('readAddPlanArgs (D8, code-review-1 N2)', () => {
  it('reads the tenant slug and the new plan', () => {
    expect(readAddPlanArgs(VALID)).toEqual({
      tenantSlug: 'acme',
      plan: { name: 'Pro yearly', amountMinor: 49000, currency: 'ILS', interval: 'month' },
    });
  });

  it.each(['--slug', '--plan-name', '--amount-minor', '--currency', '--interval'])('rejects a missing %s', (flag) => {
    expect(() => readAddPlanArgs(withoutFlag(flag))).toThrow();
  });

  it('rejects a non-numeric amount', () => {
    expect(() => readAddPlanArgs(withFlag('--amount-minor', 'lots'))).toThrow();
  });
});
