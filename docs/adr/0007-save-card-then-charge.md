# ADR 0007: The first checkout saves the card, and the first charge runs after activation

**Status:** Accepted, 2026-10-16
**Slice:** 4 (port and checkout mode), 5 (activation and charge #1)

## Context

Slice 4 allows several `incomplete` subscriptions per customer, so an abandoned checkout never blocks a retry. The partial unique index `subscriptions_one_live_per_customer` allows at most one `active` or `past_due` row per customer.

Spec 1 row 1 starts a hosted checkout that charges the first payment, and row 2 activates on the webhook. With that ordering, money moves on the provider's page, outside our control, before the index is ever consulted. A customer with two open checkouts can pay both. The second activation then hits the index after the charge has settled, and the only remedy is a refund. Refunds are out of scope for v1 (WORKPLAN, "Deliberately not in the plan").

We considered three remedies:

- **A.** Answer `409` at create when the customer already has a live subscription. This catches the common case but not two `incomplete` checkouts that are both paid, because neither is live at create time.
- **B.** Allow one open checkout per customer by widening the index to `incomplete`. An abandoned checkout then needs a lease expiry. Expiring the row is only safe once the provider's page can no longer be paid, and that is a provider fact we can't enforce. A stale tab paid after the row is canceled loses money outright, because row 16 makes a webhook for a `canceled` row a no-op.
- **C.** Take the card on the provider's page without charging it, activate, and charge only if activation succeeded. This is the only ordering in which the step that can say no (the index) runs before the irreversible step (moving money).

C has two shapes:

- **C1. Save the card, then charge.** The checkout stores a token and charges nothing. After activation, we charge the token through `provider.charge`.
- **C2. Hold, then capture.** The checkout places an authorization hold for the amount. After activation, we capture the hold, and on conflict we release it.

What we know about Grow, from its developer documentation (to confirm in the slice 13 sandbox):

- Token-only checkout ("save the token without immediate payment") exists. It needs Grow's token permission, which we need anyway because self-managed renewals charge a saved token.
- Hold-then-charge exists as J5 then J4. It needs a separate Grow permission. The documented way to release a hold is a J4 charge followed by an immediate refund, otherwise the hold expires on its own after 7 to 10 days.

## Decision

1. **C: money moves only after activation succeeds.** The founder intends to sell this service, so a buyer's customers must never be charged twice for one entitlement, whichever provider is plugged in.
2. **C1 over C2**, for five reasons:
   - **No extra permission.** C1 uses the token permission that self-managed renewals already require. C2 adds a J5 approval on top.
   - **The "no" path costs the customer nothing.** Under C1, a rejected activation leaves an unused saved card. Under C2 on Grow, saying no means charging and refunding, or tying up the customer's credit for up to 10 days. That is the very refund path C exists to avoid.
   - **One charge path.** Charge #1 goes through the same `provider.charge` call, dedup key and row-locked transaction as renewals (row 5) and retries (rows 10 and 14). C2 would add a capture and a void to the port for a single use.
   - **The spec already requires it.** Rows 13 and 14 need a capture-mode checkout that saves a token without charging. Every provider that can run our schedule therefore already supports C1. C2 is an extra capability almost no other row needs.
   - **Holds expire; tokens don't.** A capture has to happen inside the hold window. A token is charged when we decide, which keeps activation independent of provider timing.
3. **A provider declares it with `saveCardWithoutCharge: boolean`** in `ProviderCapabilities`, alongside `selfManagedSchedule`, `signedWebhooks` and `refunds`.
4. **v1 supports only self-managed providers that declare `saveCardWithoutCharge`.** `createApp` refuses to start with a provider that has `selfManagedSchedule: true` and `saveCardWithoutCharge: false`. A buyer who wires in an adapter we can't run safely gets an error at boot, never a double charge in production. `unconfiguredProvider` is exempt because it declares no capabilities and throws on every call.
5. **Checkout mode follows the capability.** `createSubscription` starts the checkout in `CHECKOUT_MODE.CAPTURE`. Until a fallback exists, there is no `CHARGE` branch to choose.
6. **Activation, then charge (slice 5).** On `checkout_completed`, one transaction holding the subscription row lock does three things in order. It stores the payment method. It moves the row to `active` with period 1, which is where the index decides. Only if that succeeded does it call `provider.charge` with dedup key `subscriptionId:periodEnd:0`. A concurrent second activation for the same customer waits on the index and then fails before any charge. Its row becomes `canceled` with no charge, and the tenant is told.

## Deferred, recorded so it is not forgotten

- **Providers without `saveCardWithoutCharge`.** The safe fallback has four layers:
  - charge at checkout (`CHECKOUT_MODE.CHARGE`);
  - answer `409` at create when the customer is already live;
  - on an activation conflict after payment, cancel the row, emit an event, and refund through the provider when `capabilities.refunds` allows, otherwise flag the charge for manual refund;
  - keep the boot guard for any provider with neither capability.

  This needs the refund flow that v1 excludes, so it is not built. When it is, the boot guard narrows to "neither `saveCardWithoutCharge` nor `refunds`". PRD open question 6.
- **First charge declined after the card was saved.** The payer has already left the provider's page when the decline happens. The two candidates are to keep the row `incomplete` with a `subscription.checkout_failed` event, so a retry is possible until the 12h TTL (row 3, D1), or to cancel it immediately. Decide before slice 5 is coded. PRD open question 7.
- **External-schedule providers (app stores, v2)** don't use our checkout at all, and the store itself prevents a second purchase in the same subscription group. This ADR doesn't apply to them.

## Consequences

- Spec 1 rows 1 and 2 are read through this ADR: row 1's checkout saves a card, and row 2's "record charge #1" happens after the move to `active` and only if it succeeded. The spec is not edited; this ADR is the correction of record, as ADR 0005 was.
- The slice 3 transition table needs the slice 5 additions: an activation that loses to the index, and a declined first charge. Neither is in the table today.
- The payer sees "card saved" on the provider's page, and the charge arrives moments later from our server. If a provider insists on 3DS for that first merchant-initiated charge, it can decline. That is the deferred decline question, and the Grow sandbox in slice 13 will show how often it happens.
- Grow's token-only checkout must be confirmed in the slice 13 sandbox. If it turns out not to exist, Grow fails the boot guard, and the deferred fallback becomes v1 work.
