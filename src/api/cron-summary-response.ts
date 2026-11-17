import type { Context } from 'hono';
import { HTTP_STATUS } from '@/api/http-status';
import type { CronSummary } from '@/lib/cron/cron-summary';

export const cronSummaryResponse = (c: Context, summary: CronSummary) =>
  c.json(summary, summary.failed > 0 ? HTTP_STATUS.INTERNAL_SERVER_ERROR : HTTP_STATUS.OK);
