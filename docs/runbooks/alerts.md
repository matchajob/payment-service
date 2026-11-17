# Alerts runbook

Each alert in `iac/log-alerts.ts` links to a section here. Alerts go to the email set by `pulumi config set alertEmail`, at most one notification per alert every 5 minutes.

Logs: Cloud Logging, filtered on `resource.type="cloud_run_revision" AND resource.labels.service_name="payment-service"`. App lines are pino JSON: `jsonPayload.level` (40 warn, 50 error), `jsonPayload.msg`, and the fields of each line.

## Cron run failed

Cloud Scheduler got a non-2xx answer from `/internal/cron/<job>`.

1. Read the job's attempt in Scheduler. A 500 whose body is a summary (`{ processed, failed }`) means some items failed (ADR 0026). Any other 500 or a 504 means the run crashed or timed out.
2. Find the errors the same run logged ("service error" below). Each failed item logs its `subscriptionId` or `chargeId`.
3. Failed items are already deferred, and the next hourly run retries them. Nothing has to be re-run by hand. Act only on the cause: a provider outage, a broken connection's credentials, or a bug.
4. `drain-outbox` and `purge-idempotency` never answer 500 for a tenant's broken endpoint. A failure there is our own.

## Service error

Any line at `jsonPayload.level>=50`, or a Cloud Run error such as a crash, an out-of-memory kill or a failed startup probe.

| `msg` | Meaning | Action |
|---|---|---|
| `outbox event dead-lettered; redrive it once the receiver is fixed` | A tenant's webhook endpoint failed all 8 attempts, or the 8th attempt's lease ran out. | Tell the tenant. Once their endpoint works: `pnpm outbox:redrive --event <outboxEventId>`, or `--tenant <tenantId>` for all of theirs. An event whose `lastError` is `lease expired with no result` may already have been delivered, and the tenant dedups by event id. |
| `charge cycle failed`, `reconcile failed`, `checkout expiration failed` | One item threw. It has been deferred to the next run. | Read `err`. If a charge needs a human decision: `pnpm charges:settle --charge <chargeId> ...`. |
| `unhandled` | A request crashed with a 500. | Read `err` and `path`. A webhook that crashed stays unprocessed and the provider redelivers it. |
| `shutdown failed` | SIGTERM handling failed. | Usually harmless, because Cloud Run kills the instance anyway. Look at `err`. |

## Cron budget spent

A run reached its 240s budget and left `remaining` items for the next run (ADR 0026). Once in a while is fine. Every hour means more becomes due than one run can do. Raise the batch limit or the run frequency, or find the slow provider calls.

## Restore

See `restore.md`.
