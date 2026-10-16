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

const FLAG = {
  WEBHOOK_URL: 'webhook-url',
  PLAN_NAME: 'plan-name',
  AMOUNT_MINOR: 'amount-minor',
  ORGANIZATION_NAME: 'organization-name',
} as const;

export type SeedArgs = z.infer<typeof seedArgsSchema>;

export const readSeedArgs = (argv: string[]): SeedArgs => {
  const { values } = parseArgs({
    args: argv,
    options: {
      slug: { type: 'string' },
      [FLAG.WEBHOOK_URL]: { type: 'string' },
      [FLAG.PLAN_NAME]: { type: 'string' },
      [FLAG.AMOUNT_MINOR]: { type: 'string' },
      [FLAG.ORGANIZATION_NAME]: { type: 'string' },
      provider: { type: 'string' },
      credentials: { type: 'string' },
      currency: { type: 'string' },
      interval: { type: 'string' },
    },
  });
  return seedArgsSchema.parse({
    organization: { name: values[FLAG.ORGANIZATION_NAME] },
    connection: { provider: values.provider, credentials: values.credentials },
    tenant: { slug: values.slug, webhookUrl: values[FLAG.WEBHOOK_URL] },
    plan: {
      name: values[FLAG.PLAN_NAME],
      amountMinor: Number(values[FLAG.AMOUNT_MINOR]),
      currency: values.currency,
      interval: values.interval,
    },
  });
};
