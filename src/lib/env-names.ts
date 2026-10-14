export const ENV = {
  DATABASE_URL: 'DATABASE_URL',
  CRON_SECRET: 'CRON_SECRET',
  PORT: 'PORT',
  LOG_LEVEL: 'LOG_LEVEL',
} as const;

export type EnvName = (typeof ENV)[keyof typeof ENV];
