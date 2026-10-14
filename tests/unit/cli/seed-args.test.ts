import { describe, expect, it } from 'vitest';
import { readSeedArgs } from '@/cli/seed-args';

const VALID = [
  '--slug',
  'acme',
  '--webhook-url',
  'https://acme.test/webhooks',
  '--plan-name',
  'Pro monthly',
  '--amount-minor',
  '4900',
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

describe('readSeedArgs', () => {
  it('reads a complete set of flags into a tenant and a plan', () => {
    expect(readSeedArgs(VALID)).toEqual({
      tenant: { slug: 'acme', webhookUrl: 'https://acme.test/webhooks' },
      plan: { name: 'Pro monthly', amountMinor: 4900, currency: 'ILS', interval: 'month' },
    });
  });

  it('rejects a missing flag', () => {
    expect(() => readSeedArgs(withoutFlag('--slug'))).toThrow();
  });

  it('rejects a non-numeric amount', () => {
    expect(() => readSeedArgs(withFlag('--amount-minor', 'abc'))).toThrow();
  });

  it('rejects an unknown currency', () => {
    expect(() => readSeedArgs(withFlag('--currency', 'EUR'))).toThrow();
  });
});
