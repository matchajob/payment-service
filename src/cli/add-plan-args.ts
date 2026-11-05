import { parseArgs } from 'node:util';
import { z } from 'zod';
import { planArgOptions, planArgsOf, planArgsSchema } from '@/cli/plan-args';
import { zTenantCreate } from '@/lib/tenants/schema';

const addPlanArgsSchema = z.object({ tenantSlug: zTenantCreate.shape.slug, plan: planArgsSchema });

export type AddPlanArgs = z.infer<typeof addPlanArgsSchema>;

export const readAddPlanArgs = (argv: string[]): AddPlanArgs => {
  const { values } = parseArgs({ args: argv, options: { slug: { type: 'string' }, ...planArgOptions } });
  return addPlanArgsSchema.parse({ tenantSlug: values.slug, plan: planArgsOf(values) });
};
