import { parseArgs } from 'node:util';
import { z } from 'zod';
import { zOrganizationCreate } from '@/lib/organizations/schema';
import { zPlanCreate } from '@/lib/plans/schema';
import { zProviderConnectionRead } from '@/lib/provider-connections/schema';
import { zTenantCreate } from '@/lib/tenants/schema';

const seedArgsSchema = z.object({
  organization: zOrganizationCreate.pick({ name: true }),
  connection: z.object({ provider: zProviderConnectionRead.shape.provider, credentials: z.string().nonempty() }),
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
      'organization-name': { type: 'string' },
      provider: { type: 'string' },
      credentials: { type: 'string' },
      currency: { type: 'string' },
      interval: { type: 'string' },
    },
  });
  return seedArgsSchema.parse({
    organization: { name: values['organization-name'] },
    connection: { provider: values.provider, credentials: values.credentials },
    tenant: { slug: values.slug, webhookUrl: values['webhook-url'] },
    plan: {
      name: values['plan-name'],
      amountMinor: Number(values['amount-minor']),
      currency: values.currency,
      interval: values.interval,
    },
  });
};
