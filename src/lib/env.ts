import type { EnvName } from '@/lib/env-names';

export const readRequiredEnv = (name: EnvName): string => {
  const value = process.env[name];
  if (value === undefined) throw new Error(`${name} is not set`);
  return value;
};
