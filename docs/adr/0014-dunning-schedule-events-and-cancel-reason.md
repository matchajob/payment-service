# ADR 0014: Dunning stores its next retry, shares one charge engine with renewal, and says why a subscription ended

**Status:** Accepted, 2026-10-16
**Slice:** 10. Touches slice 8 (renewal) and slice 5 (charge #1).

## Context

A declined renewal leaves a subscription `past_due` (S1 r6). Spec 2 says retries follow the tenant's `dunningScheduleDays`, counted from the failed attempt 0, and S1 r11 says the final failure cancels with `reason: payment_failure`. Four questions came up while designing slice 10.

## Decisions

1. **The next retry is stored, not derived.** `subscriptions` gains `dunningStartedAt` (the failed attempt 0) and `nextRetryAt`.
   - A declined renewal sets `dunningStartedAt` to the charge's `attemptedAt` and `nextRetryAt` to `nextRetryAt(dunningStartedAt, 1, schedule)`.
   - A failed retry moves `nextRetryAt` to the next offset, always measured from `dunningStartedAt`.
   - A rescue or a cancel clears both.
   - Check constraints:
     - `nextRetryAt` is set if and only if the status is `past_due`.
     - `dunningStartedAt` is set exactly when `nextRetryAt` is.
   - The due query is `nextRetryAt <= now`, and it is indexed.
   - Each retry time is fixed when it is computed. A tenant who edits their schedule changes the retries computed after that edit, never one already scheduled.
   - Row 14 (slice 11) becomes "set `nextRetryAt` to now and restart the clock", which is how the spec's "supersedes the pending scheduled retry" is met.
2. **Renewal and dunning run on one charge engine.** `runChargeCycle(cycle, deps, now)` owns:
   - the batch loop with per-row isolation;
   - building the provider from the pinned connection before tx1;
   - tx1: lock with `SKIP LOCKED`, re-verify, and commit the pending charge;
   - the provider call;
   - tx2: record the charge and apply the transition.

   A `ChargeCycle` supplies what differs: its due query, its due check under the lock, its attempt number, its due event, and its decision after the provider answers. ADR 0008 and ADR 0013 now hold in one place. Slice 11's immediate retry becomes a third cycle.
3. **Every failed retry emits `charge.failed`.** This departs from the spec, which only names the events on the first failure and the final one. Tenants can then nudge the customer after each attempt, as Stripe's `invoice.payment_failed` does. The final failure emits `charge.failed`, then `subscription.canceled`, mirroring the first failure (`charge.failed`, then `subscription.past_due`). Row 14's failure (`immediate_retry_failed`) emits `charge.failed` too, for the same reason.
4. **The reason a subscription ended is stored and published.** `subscriptions` gains `cancelReason`, which is set if and only if the status is `canceled`. The subscription snapshot in the published contract gains `cancelReason` (nullable). The values:

   | Value | Set by |
   |---|---|
   | `payment_failure` | a declined charge #1; the final failed retry |
   | `customer_request` | row 7 (a flagged subscription reaches its period end); row 12 (cancel while `past_due`, slice 9) |
   | `already_subscribed` | a second paid checkout loses to the one-live index (ADR 0007) |
   | `checkout_expired` | row 3 (housekeeping, slice 12) |

   All four values are published now, including the ones only later slices set. Receivers validate the snapshot against the published enum, so adding a value later would make an older receiver reject events.

## Consequences

- Spec 1 r11's "(reason: payment_failure)" is met through the snapshot's `cancelReason`, not through a field on the event envelope.
- A tenant schedule must not be empty (`min(1)` on `dunningScheduleDays`). With an empty schedule, a `past_due` subscription would have no retry and no end. The engine still has a safe fallback for legacy rows: retry at the next run, which is then final.
- The transition table changes the emits of `retry_failed`, `final_retry_failed` and `immediate_retry_failed`. The spec isn't edited; this ADR is the correction of record.
- `runRenewal` keeps its signature as a thin wrapper, so slice 8's tests pin the refactor onto the engine.
