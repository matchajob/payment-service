import type { Tenant } from '@/lib/tenants/schema';

export type AppEnv = { Variables: { tenant: Tenant } };
