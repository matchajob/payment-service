import { ENV } from '@/lib/env-names';

export const RUNTIME_SECRET_ENV = [ENV.DATABASE_URL] as const;

export type RuntimeSecretEnv = (typeof RUNTIME_SECRET_ENV)[number];
