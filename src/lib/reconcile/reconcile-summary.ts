import type { CronSummary } from '@/lib/cron/cron-summary';

export type ReconcileSummary = CronSummary & { flagged: number };
