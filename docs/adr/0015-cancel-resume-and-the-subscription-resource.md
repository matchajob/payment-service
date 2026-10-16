# ADR 0015: Cancel and resume answer with the event snapshot, and refuse while a charge is in flight

**Status:** Accepted, 2026-10-16
**Slice:** 9.

## Context

Slice 9 adds `cancel` and `resume` (S1 r4, r8, r9, r12, r15). Three questions came up while designing it:

1. Row 8 says the response "carries flag + effective date", but the API had no subscription resource.
2. The table has no row for `resume` on an `active` subscription that was never flagged.
3. A charge commits `pending` in tx1 and settles in tx2 (ADR 0008). A cancel that lands between the two leaves tx2 sending an event the new state doesn't accept:
   - **Renewal:** the period isn't advanced. The next run's row 7 then cancels a subscription the customer just paid for.
   - **Dunning:** the retry settles into a terminal `canceled` row (D6). The payment is taken, and the subscription stays canceled.

## Decisions

1. **The subscription resource is the event snapshot.** `GET /v1/subscriptions/:id`, `POST …/cancel` and `POST …/resume` all answer `{ data: SubscriptionSnapshot }`. The snapshot in the published contract gains `canceledAt` (nullable). The effective date of a cancel is then:
   - `currentPeriodEnd` while the flag is set;
   - `canceledAt` once the subscription is canceled.

   A tenant's mirror can upsert from an event or a response with the same code, and GET is how it repairs itself after a missed event.
2. **`resume` on an `active` subscription that was never flagged answers `200` and changes nothing.** This is symmetric with row 8's idempotent cancel. `resume` on `incomplete`, `past_due` or `canceled` stays `409`.
3. **`cancel` answers `409` with `Retry-After` while the subscription has any `pending` charge.** That's the same "never wait on another request's fate" rule as D9. The check is any pending charge on the subscription, not only one for the current period: charge #1's period end equals `currentPeriodEnd`, and its race is the same. If a charge timed out, cancel is refused until reconcile settles it (slice 12). That's rare and honest: until then, we don't know whether the customer paid.

## Consequences

- Cancel and resume lock the row with a blocking `FOR UPDATE`, not `SKIP LOCKED`. An API caller must get a definite answer.
- A `409` names its cause in `detail`: the state machine's rejection reason (`not_accepted_in_state`, `resume_not_allowed`, `store_managed`) or `charge_in_flight`.
- Row 12 clears `nextRetryAt` and `dunningStartedAt` and sets `cancelReason: customer_request`. ADR 0014's constraints require both.
