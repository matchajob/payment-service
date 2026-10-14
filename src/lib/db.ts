import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolveDbProvider } from '@matcha/infra/postgres/resolve';

export const createDb = (url: string) => {
  const provider = resolveDbProvider(url);
  return drizzle(postgres(provider.url(url), provider.config(url)));
};

export type Db = ReturnType<typeof createDb>;
