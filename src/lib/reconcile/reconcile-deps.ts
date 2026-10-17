import type { Logger } from 'pino';
import type { Database } from '@/lib/db';
import type { ProviderFor } from '@/lib/provider-connections/provider-for';

export type ReconcileDeps = { db: Database; providerFor: ProviderFor; logger: Pick<Logger, 'error'> };
