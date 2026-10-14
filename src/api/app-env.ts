import type { Database } from '@/lib/db';
import type { Tenant } from '@/lib/tenants/schema';

export type AppEnv = { Variables: { tenant: Tenant; db: Database } };
