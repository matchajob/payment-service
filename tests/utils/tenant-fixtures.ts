import type { CreateTenantInput } from '@/lib/tenants/create-tenant';

export type TenantFixture = Pick<CreateTenantInput, 'slug' | 'webhookUrl'>;

export const ACME: TenantFixture = { slug: 'acme', webhookUrl: 'https://acme.test/webhooks' };
export const GLOBEX: TenantFixture = { slug: 'globex', webhookUrl: 'https://globex.test/webhooks' };
