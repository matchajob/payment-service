import { describe, expect, it } from 'vitest';
import { readSeedArgs } from '@/cli/seed-args';
import { PAYMENT_PROVIDER } from '@/lib/payments/payment-provider-name';
import { GROW_CREDENTIALS } from '@tests/utils/provider-credentials-fixtures';

const VALID = [
  '--organization-name',
  'Acme Ltd',
  '--provider',
  PAYMENT_PROVIDER.GROW,
  '--credentials',
  GROW_CREDENTIALS,
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
  it('reads a complete set of flags into an organization, a connection, a tenant and a plan (ADR 0010)', () => {
    expect(readSeedArgs(VALID)).toEqual({
      organization: { name: 'Acme Ltd' },
      connection: { provider: PAYMENT_PROVIDER.GROW, credentials: GROW_CREDENTIALS },
      tenant: { slug: 'acme', webhookUrl: 'https://acme.test/webhooks' },
      plan: { name: 'Pro monthly', amountMinor: 4900, currency: 'ILS', interval: 'month' },
    });
  });

  it.each(['--slug', '--organization-name', '--provider', '--credentials'])('rejects a missing %s', (flag) => {
    expect(() => readSeedArgs(withoutFlag(flag))).toThrow();
  });

  it('rejects an unknown provider', () => {
    expect(() => readSeedArgs(withFlag('--provider', 'paypal'))).toThrow();
  });

  it('rejects empty credentials', () => {
    expect(() => readSeedArgs(withFlag('--credentials', ''))).toThrow();
  });

  it('rejects a non-numeric amount', () => {
    expect(() => readSeedArgs(withFlag('--amount-minor', 'abc'))).toThrow();
  });

  it('rejects an unknown currency', () => {
    expect(() => readSeedArgs(withFlag('--currency', 'EUR'))).toThrow();
  });
});
