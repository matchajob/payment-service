import { SERVICE_NAME } from '@iac/cloud-run-service';
import { CRON_BUDGET_SPENT } from '@/lib/cron/for-each-within-budget';

export type LogAlert = { name: string; title: string; filter: string; whatToDo: string };

const PINO_ERROR_LEVEL = 50;
const RUNBOOK = 'docs/runbooks/alerts.md';
const CLOUD_RUN_REVISION = 'cloud_run_revision';
const SCHEDULER_JOB = 'cloud_scheduler_job';
const ERROR_SEVERITY = 'severity>=ERROR';
const SERVICE_LOGS = `resource.type="${CLOUD_RUN_REVISION}" AND resource.labels.service_name="${SERVICE_NAME}"`;

export const LOG_ALERTS: readonly LogAlert[] = [
  {
    name: 'cron-run-failed',
    title: 'A cron run failed',
    filter: `resource.type="${SCHEDULER_JOB}" AND ${ERROR_SEVERITY}`,
    whatToDo: `A Scheduler job got a non-2xx answer: an item failed, or the run crashed. See "cron run failed" in ${RUNBOOK}.`,
  },
  {
    name: 'service-error',
    title: 'payment-service logged an error',
    filter: `${SERVICE_LOGS} AND (jsonPayload.level>=${PINO_ERROR_LEVEL} OR ${ERROR_SEVERITY})`,
    whatToDo: `An error from the app (a failed charge, a dead-lettered event, an unhandled request) or from Cloud Run itself. See "service error" in ${RUNBOOK}.`,
  },
  {
    name: 'cron-budget-spent',
    title: 'A cron left work for the next run',
    filter: `${SERVICE_LOGS} AND jsonPayload.msg="${CRON_BUDGET_SPENT}"`,
    whatToDo: `A run hit its time budget (ADR 0026). Once is fine; every hour means the backlog is growing. See "cron budget spent" in ${RUNBOOK}.`,
  },
];
