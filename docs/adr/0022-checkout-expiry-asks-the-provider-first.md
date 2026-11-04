# ADR 0022: Checkout expiry asks the provider first, and an unconfirmed webhook stays unprocessed

**Status:** Accepted, 2026-11-04
**Amends:** Spec 4 rule 6 (when a webhook counts as processed), Spec 1 r3 (checkout expiry), ADR 0021 decision 2 (housekeeping joins the deferred queues).
**Fixes:** code-review-1 M1.

## Context

A provider's checkout webhook is only a hint. We confirm it with `verifyCheckout` (Spec 4 rule 3). Two paths could lose a customer who had finished on the hosted page:

- When `verifyCheckout` answered `NOT_COMPLETED` (the provider's lookup was lagging behind its own notify, say), the webhook was still marked processed. A byte-identical redelivery was then deduplicated away.
- Housekeeping expired every `incomplete` subscription older than `checkoutTtlHours` without asking the provider. A customer who saved a card was canceled, and the card was left saved with no subscription.

Answering 5xx so the provider redelivers was rejected. Grow's production review checks that we answer 200 to notifies, and no provider promises how long it keeps redelivering.

## Decision

1. `completeCheckout` and `completePaymentMethodUpdate` return `handled` or `not_completed`. The webhook route marks the event processed only when the result is `handled`. It still answers 200 either way, and a redelivery is interpreted again because `processedAt` is null.
2. Before expiring a checkout that has a provider session, housekeeping runs `completeCheckout` against the provider. If the card was saved, the subscription activates and charge #1 is taken, exactly as the webhook would have done it. If not, the subscription is expired as before. A checkout with no session ref expires directly.
3. When asking the provider throws, the subscription stays `incomplete`. Housekeeping stamps `cycle_deferred_at` and sorts by `greatest(created_at, cycle_deferred_at)`, so an unreachable provider can't starve the batch (ADR 0021). An incomplete subscription has no renewal or dunning, so sharing the column with those queues is safe.

## Consequences

- Housekeeping can now move money: it may take charge #1. It goes through the same activation, dedup key and one-live index as the webhook, so a webhook and housekeeping racing on the same checkout still charge once (`RACED`).
- A provider that stays down keeps its checkouts `incomplete` past the TTL. They expire on the first run that can ask.
- A card saved after housekeeping's `NOT_COMPLETED` answer and before the expiry commits is still left saved with no subscription. No money moves. Making the provider's own session expire (N1) narrows that window.
- Webhook events that never confirm stay unprocessed. They are harmless rows; housekeeping is the backstop that settles their subscriptions.
