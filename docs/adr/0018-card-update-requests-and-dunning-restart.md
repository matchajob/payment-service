# ADR 0018: Card updates are requests of their own, and a failed rescue restarts the schedule

**Status:** Accepted, 2026-10-17
**Slice:** 11. Spec 1 rows 13 and 14, D5.

## Context

Row 13 lets a tenant send a customer to a capture-mode checkout that replaces the card without charging. Row 14 adds that, from `past_due`, the new card is retried at once, and a failure "resets the dunning clock".

Two questions had more than one defensible answer:

1. The checkout webhook is unsigned (Grow). Today it trusts a completion only because the session is the one stored on the subscription (`checkoutSessionRef`) and `verifyCheckout` confirms it. Where does an update's session live?
2. Attempt numbers must keep increasing within a period: the dedup key is `subscriptionId:periodEnd:attempt` and `charges_one_per_attempt` is unique on it. The dunning schedule, though, is indexed by attempt (`nextRetryAt(start, attempt, schedule)`). So what does "resets" mean?

## Decision

1. **A `payment_method_updates` table, one row per request.** It holds the subscription, its pinned connection, the provider's `sessionRef` (unique per connection), `requestedAt` and `completedAt`. The webhook finds a completed checkout here by session first, and only then falls back to the subscription's own activation checkout. Every link the customer was sent still works, so an older link completed after a newer one was requested still replaces the card. The alternative, overwriting `checkoutSessionRef`, would have silently ignored that customer.
2. **`subscriptions.dunningAttemptBase`, the attempt the current dunning clock started at.** The schedule is indexed by `attempt - dunningAttemptBase`. A failed immediate retry sets the base to its own attempt, the clock to now and the next retry one schedule step later, so the customer gets the full schedule again while attempt numbers stay unique. A check constraint keeps `dunningAttemptBase <= dunningAttempt`. Starting dunning and a successful retry both set it back to 0.
3. **The immediate retry runs inside the webhook request**, the way charge #1 does (ADR 0008): tx1 replaces the card and inserts a `pending` charge for attempt `dunningAttempt + 1`; then `provider.charge` on the new card; then tx2 settles. Success is `retry_succeeded`, the same row a scheduled retry uses. Failure is `immediate_retry_failed`.
4. **The immediate and the scheduled retry cannot both fire.** They compute the same attempt number for the same period, so `charges_one_live_per_period` and `charges_one_per_attempt` let only one in. If a scheduled retry is already in flight when the card is replaced, there is no immediate retry; the scheduled one settles on its own. After either one settles, the other finds nothing due.
5. **The card is captured on the subscription's pinned connection**, not the tenant's current one (ADR 0010 decision 2), because that connection is the one that charges it.
6. **The route is `POST /v1/subscriptions/:id/update-payment-method` with `{ returnUrl }`, answering `201` with the checkout URL.** It is `409` for `incomplete` (no card yet; the original checkout is the way in), `canceled` and store-billed subscriptions, via the state machine's existing `payment_method_updated` rows.

## Consequences

- An immediate retry that times out stays `pending`, and reconcile (ADR 0017) settles it. Reconcile sees attempt ≥ 1 and settles it as a scheduled retry: a late failure schedules the next retry on the current clock instead of restarting it. This is rare and errs toward fewer retries, so it is accepted for v1.
- A customer can restart dunning as often as they capture a new card. Each restart costs them a real checkout, and each retry is a real charge attempt on a new card, so this is accepted.
