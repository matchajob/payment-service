# ADR 0013: Renewal runs hourly, in bounded batches, skipping locked rows

**Status:** Accepted, 2026-10-16
**Slice:** 8. Dunning (slice 10) reuses the same shape.

## Context

Spec 2 says due detection is a "daily cron" and that day-level precision is the contract. Three questions came up while designing slice 8:

1. Every anniversary keeps the time of day it was activated (`advancePeriod` preserves hours and minutes). A daily run at a fixed hour charges most customers up to 23 hours after their period ended. They remain `active` on an unpaid period for that time.
2. Each renewal includes a network call to the provider. A run with no limit gets slower as the number of subscriptions grows, until it hits the 300s request timeout (`iac/request-timeout.ts`). The rows it didn't reach wait for the next run.
3. Two runs can overlap: a slow run, a Scheduler retry, or a deploy during a run.

## Decision

1. **Hourly.** The renewal job is scheduled at `0 * * * *`. This departs from Spec 2's wording, not its contract: day-level precision is still met, more tightly. An idle run is a single indexed query.
2. **At most `RENEWAL_BATCH_LIMIT` (100) subscriptions per run, oldest period end first.** Each renewal commits on its own (ADR 0008), so a run that times out leaves no partial state. The rest wait an hour. 100 rows at a typical ~1s provider call fits the 300s timeout with room to spare.
3. **The due query excludes subscriptions that already have a live charge (`pending` or `succeeded`) for their current period.** A renewal whose provider call timed out stays `pending` until reconcile (slice 12). Excluding it means it is never re-attempted, and it never takes up a place in the next batch.
4. **tx1 locks with `FOR UPDATE SKIP LOCKED`.** An overlapping run skips a row another run holds instead of waiting on it. After taking the lock, tx1 re-checks the status, the period end and the live charge. So `charges_one_live_per_period` stays a tripwire that fires only on a real bug, never on ordinary contention. This is the same choice as the outbox claim (ADR 0009).
5. **No Scheduler retries for this job.** The next hourly run is the retry.

## Consequences

- Spec 2's "daily cron" is superseded by this ADR. The spec isn't edited; this ADR is the correction of record, as ADR 0005 and ADR 0008 were.
- A backlog larger than 100 subscriptions drains over several hours. If that becomes normal, raise the limit or run more often. Both are one-line changes.
- Rows in a batch run one after another, not in parallel. Every renewal opens its own transactions, and the provider sees at most one call in flight per run.
