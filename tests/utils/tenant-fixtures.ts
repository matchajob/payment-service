import type { CreateTenantInput } from '@/lib/tenants/create-tenant';

export const ACME: CreateTenantInput = { slug: 'acme', webhookUrl: 'https://acme.test/webhooks' };
export const GLOBEX: CreateTenantInput = { slug: 'globex', webhookUrl: 'https://globex.test/webhooks' };
