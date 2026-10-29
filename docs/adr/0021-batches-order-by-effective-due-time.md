# ADR 0021: Batch queues order by effective due time, so a row that makes no progress goes to the back

**Status:** Accepted, 2026-10-20
**Amends:** ADR 0013 decision 2 (renewal, and dunning which reuses it), ADR 0017 decision 2 (reconcile).
**Fixes:** code-review-1 H4 and N7.

## Context

Renewal, dunning, reconcile and the lost-charge sweep each take at most a batch limit of rows per hourly run, oldest first. They sort by a column (`current_period_end`, `next_retry_at`, `attempted_at`) that nothing changes when a row fails:

- A renewal or retry that throws before its charge is inserted rolls back. Causes include a connection whose credentials can't be decrypted, a missing card, and missing parents. Next hour the row sorts first again.
- A reconcile step that throws (the provider can't be built), or that leaves the charge untouched (the provider still says pending, or still can't find it), leaves the row first for up to 7 days.

A batch limit's worth of such rows (one tenant with a broken connection is enough) stops billing for every tenant.

## Options considered

1. **Effective due time (chosen).** Each queue gets one nullable timestamp, stamped when a run picks a row and it makes no progress. The finder sorts by `greatest(due, stamp)`.
2. **Skip within the run.** Re-query in a loop, excluding this run's failures. This needs no schema change, but poison rows are retried first every hour, a hanging provider can use up the request timeout, and nothing persists between runs.
3. **Exponential backoff.** Strongest against a slow broken provider, but it adds state and constants, and a tenant whose credentials were fixed waits out its backoff before anyone is charged.

## Decision

1. `subscriptions.cycle_deferred_at` and `charges.reconcile_deferred_at`, both nullable timestamps.
2. **Renewal and dunning** stamp `cycle_deferred_at = now` when a row throws. They don't stamp `SKIPPED`: the usual cause is another run holding the row lock, and an `UPDATE` would wait on that lock.
3. **Reconcile and the lost-charge sweep** stamp `reconcile_deferred_at = now` when a step throws or returns `LEFT`.
4. The stamp is written in the runner, in its own statement, after the row's transaction has ended. A stamp written inside a transaction that throws would roll back with it.
5. Finders sort by `greatest(due column, deferred column)`. Postgres ignores NULLs in `greatest`, so a row that never failed sorts by its due time as before.
6. Stamps are never cleared. A stamp is the time a run last saw the row, so it is always earlier than any later due time. Next period's renewal, or a later retry, therefore sorts by its own due time again.

## Consequences

- A failing row sorts as if it fell due when it last failed: behind everything due before then, and ahead of anything due later. It is still retried every run that has room, so a fixed connection resumes charging on the next run with no operator step.
- The sort is now an expression, so an index on the due column alone doesn't serve it. An expression index belongs with M15 (hot queries have no index).
- A charge carries its reconcile stamp from the pending queue into the lost queue. That only moves it slightly later in the lost queue, which is harmless.
- A provider that hangs rather than throwing still costs a run its time budget. That is M11 (timeouts), not this ADR.
- These columns are ordering hints, not lifecycle state. Writing them emits no event and doesn't go through `applyTransition`.
