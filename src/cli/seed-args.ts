import { parseArgs } from 'node:util';
import { z } from 'zod';
import { planArgOptions, planArgsOf, planArgsSchema } from '@/cli/plan-args';
import { zOrganizationCreate } from '@/lib/organizations/schema';
import { zProviderConnectionRead } from '@/lib/provider-connections/schema';
import { zTenantCreate, zTenantRead } from '@/lib/tenants/schema';

const seedArgsSchema = z.object({
  organization: zOrganizationCreate.pick({ name: true }),
  connection: z.object({ provider: zProviderConnectionRead.shape.provider, credentials: z.string().nonempty() }),
  tenant: zTenantCreate.pick({ slug: true, webhookUrl: true }).extend({ timeZone: zTenantRead.shape.timeZone }),
  plan: planArgsSchema,
});

const FLAG = {
  WEBHOOK_URL: 'webhook-url',
  TIME_ZONE: 'time-zone',
  ORGANIZATION_NAME: 'organization-name',
} as const;

export type SeedArgs = z.infer<typeof seedArgsSchema>;

export const readSeedArgs = (argv: string[]): SeedArgs => {
  const { values } = parseArgs({
    args: argv,
    options: {
      slug: { type: 'string' },
      [FLAG.WEBHOOK_URL]: { type: 'string' },
      [FLAG.TIME_ZONE]: { type: 'string' },
      [FLAG.ORGANIZATION_NAME]: { type: 'string' },
      provider: { type: 'string' },
      credentials: { type: 'string' },
      ...planArgOptions,
    },
  });
  return seedArgsSchema.parse({
    organization: { name: values[FLAG.ORGANIZATION_NAME] },
    connection: { provider: values.provider, credentials: values.credentials },
    tenant: { slug: values.slug, webhookUrl: values[FLAG.WEBHOOK_URL], timeZone: values[FLAG.TIME_ZONE] },
    plan: planArgsOf(values),
  });
};
