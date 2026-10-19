# ADR 0017: Reconcile verifies by dedup key, hourly, and flags what it cannot settle

**Status:** Accepted, 2026-10-17
**Slice:** 12. Amends Spec 4 rule 8 ("nightly") and the `PaymentProvider` port from slice 4.

## Context

A charge whose provider call timed out stays `pending` (ADR 0008). Renewal and dunning skip a subscription with a live charge (ADR 0013), and cancel answers `409` while one is pending (slice 9). Nothing settles that row today, so the subscription is stuck: no renewal, no retry, no cancel.

Reconcile is the only way out, but the port's `verifyCharge(providerChargeRef)` can't reach the row it exists for. A timed-out charge is exactly the one that never got a `providerChargeRef`.

## Decision

1. **The port verifies by both identifiers.** `verifyCharge({ dedupKey, providerChargeRef })`, where the ref is `null` when we never got one. A new capability `lookupByReference` says whether the provider can find a charge by our dedup key alone. `VerifiedCharge` gains `not_found`, and its `succeeded` branch carries `amountMinor` and `currency`.
2. **Hourly, not nightly.** Cancel is blocked while a charge is pending, so a nightly run could leave a customer unable to cancel for about 48 hours. The job runs at `0 * * * *` with no Scheduler retry, like renewal and dunning (ADR 0013). At most `RECONCILE_BATCH_LIMIT` charges per run, oldest attempt first, each settled in its own transaction.
3. **A charge younger than 15 minutes is not verified.** Its charge call may still be running: the request timeout is 300s (`iac/request-timeout.ts`). Independently, `recordChargeResult` updates only a row that is still `pending`, and a settle that changed nothing applies no transition. A live settle and reconcile can't both advance a period.
4. **Outcomes:**

   | Provider says                           | Charge has ref                 | Age            | Result                                                                |
   | --------------------------------------- | ------------------------------ | -------------- | --------------------------------------------------------------------- |
   | `succeeded`, amount and currency match  | either                         | any            | settle through the charge's own cycle                                 |
   | `succeeded`, amount or currency differs | either                         | any            | flag `amount_mismatch`, stays `pending`                               |
   | `failed`                                | either                         | any            | settle as failed through the charge's own cycle                       |
   | `pending`                               | either                         | under 7 days   | leave it, ask again next run                                          |
   | `pending`                               | either                         | 7 days or more | flag `stuck_pending`                                                  |
   | `not_found`                             | no                             | under 24h      | leave it                                                              |
   | `not_found`                             | no                             | 24h or more    | `failed` with the not-found reason (decision X below)                 |
   | `not_found`                             | yes                            | any            | flag `ref_not_found`: it existed, so it is never failed automatically |
   | (not asked)                             | no, and no `lookupByReference` | any            | flag `no_reference_lookup`                                            |

   "Its own cycle" is the one that created it, read from the charge's stored `kind` (`first`, `renewal`, `retry`, `immediate_retry`). The cycle's existing `decide` runs, so a late renewal success moves the period to the charge's `periodEnd`, not to one computed from now, and a late immediate retry restarts dunning as the live path does (ADR 0018).
   *Amended 2026-10-19 (code-review-1 H1, H2):* the kind was first inferred from `attempt` and `attemptedAt < periodEnd`. That broke once every charge was keyed on the period it pays for, and it never had a case for immediate retries.

5. **Decision X: a lost attempt counts as a decline.** The subscription goes `past_due` (or `canceled`, for charge #1) and dunning takes over. A late failure starts the dunning clock at the settle time, not at `attemptedAt`, so the customer gets the whole retry schedule. Option Y (retry the same attempt without changing state) was rejected for v1: the one-per-attempt key and the fixed renewal key `:0` would need reworking.
6. **The late-success sweep.** For 7 days after the attempt, reconcile re-verifies charges it failed as `not_found`. If one turns out `succeeded`, the customer may have paid twice. The row stays `failed`, because `charges_one_live_per_period` would refuse a second success for the period anyway. It is flagged `late_success` for a human refund.
7. **Flags.** `charges.reconcileFlag` and `charges.flaggedAt`, set together or not at all. A flagged charge is never verified again. Every flag is logged at error level with the charge id and the flag. A human settles a flagged charge with a CLI command that goes through the same cycle, like the outbox redrive. Tenants get no event for a flag.

## Consequences

- Spec 4 rule 8's "nightly" is superseded. The spec isn't edited; this ADR is the correction of record.
- Every adapter must implement `verifyCharge` against both identifiers and say honestly whether it can look up by our reference. Grow (slice 13) must confirm this in its sandbox. Without it, every timeout becomes a manual case.
- The 24h grace, the 7-day windows and X versus Y were chosen without production data. Revisit them once the roadmap is done.
