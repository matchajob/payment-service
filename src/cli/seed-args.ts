import { parseArgs } from 'node:util';
import { z } from 'zod';
import { zPlanCreate } from '@/lib/plans/schema';
import { zTenantCreate } from '@/lib/tenants/schema';

const seedArgsSchema = z.object({
  tenant: zTenantCreate.pick({ slug: true, webhookUrl: true }),
  plan: zPlanCreate.pick({ name: true, amountMinor: true, currency: true, interval: true }),
});

export type SeedArgs = z.infer<typeof seedArgsSchema>;

export const readSeedArgs = (argv: string[]): SeedArgs => {
  const { values } = parseArgs({
    args: argv,
    options: {
      slug: { type: 'string' },
      'webhook-url': { type: 'string' },
      'plan-name': { type: 'string' },
      'amount-minor': { type: 'string' },
      currency: { type: 'string' },
      interval: { type: 'string' },
    },
  });
  return seedArgsSchema.parse({
    tenant: { slug: values.slug, webhookUrl: values['webhook-url'] },
    plan: {
      name: values['plan-name'],
      amountMinor: Number(values['amount-minor']),
      currency: values.currency,
      interval: values.interval,
    },
  });
};
