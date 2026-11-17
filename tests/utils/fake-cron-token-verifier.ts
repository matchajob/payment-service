import type { CronTokenVerifier } from '@/api/cron-token-verifier';

export const TEST_CRON_TOKEN = 'test-cron-token';

export const fakeCronTokenVerifier: CronTokenVerifier = async (token) => token === TEST_CRON_TOKEN;
