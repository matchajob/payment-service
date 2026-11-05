import type { CreateTenantInput } from '@/lib/tenants/create-tenant';

export type TenantFixture = Pick<CreateTenantInput, 'slug' | 'webhookUrl' | 'timeZone'>;

const UTC = 'UTC';

export const ACME: TenantFixture = { slug: 'acme', webhookUrl: 'https://acme.test/webhooks', timeZone: UTC };
export const GLOBEX: TenantFixture = { slug: 'globex', webhookUrl: 'https://globex.test/webhooks', timeZone: UTC };
