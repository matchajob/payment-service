# ADR 0026: Charge crons answer 500 on failure and stop at a time budget

**Status:** Accepted, 2026-11-17
**Amends:** ADR 0002 (cron endpoints return their counts with 200).
**Fixes:** code-review-1 M11, and the open timeout in M4.

## Context

Every cron endpoint answered 200 whatever happened, so a run where every charge threw looked healthy to Cloud Scheduler and nothing could alert on it.

The runners also had no time limit. A batch of 100 charges, each allowed a 10s Grow call or a 30s Stripe call plus a KMS open, can run far past Cloud Run's 300s request timeout. Cloud Run then cuts the request in the middle of a charge. That is safe, because the charge row is written `pending` first and reconcile settles it. But it ends as a 504 with no counts, and the rest of the batch is never attempted.

Provider timeouts were already in place: Grow 10s, Stripe 30s, KMS and the metadata server 10s, and tenant webhook delivery 15s. M4's open timeout is the Grow one.

## Decision

1. `renew`, `dun`, `housekeeping` and `reconcile` answer 500 when `failed > 0`. The body is still the summary. Scheduler retries these jobs 0 times, so a 500 only marks the run failed; it never repeats it. Failed items were already deferred, so the next scheduled run skips them.
2. `drain-outbox` and `purge-idempotency` keep 200. A tenant whose webhook endpoint is down is that tenant's outage, not ours. Failed deliveries back off and dead-letter, and dead letters get loud logs under M23.
3. Each charge-cron request gets a 240s budget, measured from the start of the request (`CRON_TIME_BUDGET_MS`). The runners check it before each item and stop starting new items once it is spent. They log a warning with the number of items left over, and those items stay due for the next run. A unit test keeps the budget at least 60s below `REQUEST_TIMEOUT`, so the slowest single item can finish.

## Consequences

- A failing charge run is visible as a failed Scheduler job, and step 6 can alert on it.
- A backlog larger than one budget clears across several hourly runs instead of in one long run. The warning shows when that happens every hour.
- The budget is per request, not per item. A single item that hangs is bounded by its provider timeout, not by the budget.
