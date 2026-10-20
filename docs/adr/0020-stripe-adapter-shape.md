# ADR 0020: Stripe adapter: a fetch client, opaque card refs, and trust by re-fetch

**Status:** Accepted, 2026-10-19
**Slice:** 22 (first cut). Mirrors ADR 0019's shape for Grow.

## Context

Stripe is the second provider behind the `PaymentProvider` port. It differs from Grow in four ways that touch the port.

1. **Stripe has real idempotency.** `Idempotency-Key` on a POST makes a retry return the first answer. Grow has none (ADR 0019 decision 1).
2. **Stripe signs its webhooks** (`Stripe-Signature`), but `parseWebhook(rawBody)` receives only the body. The header never reaches the adapter.
3. **A saved card is a pair.** Charging off-session needs the `customer` and the `payment_method`.
4. **Setup-mode Checkout creates no customer.** `customer_creation` is a payment-mode parameter, and a payment method saved without a customer cannot be reused.

## Decision

1. **No SDK.** `src/infra/stripe/stripe-client.ts` calls the REST API with the injected `fetch`: form-encoded bodies, `Authorization: Bearer <secretKey>`, an optional `Idempotency-Key`, and `AbortSignal.timeout`. A 2xx is `ok`; a 4xx returns Stripe's `error` object; a 5xx, a timeout, a network error or a non-JSON body throws.
2. **Credentials are `{ secretKey }`** per connection, sealed like Grow's. The base URL (`STRIPE_BASE_URL`, default `https://api.stripe.com`) and the timeout are app config. The webhook signing secret joins the credentials when decision 5's follow-up lands.
3. **Checkout.** `CAPTURE` creates a customer first (`POST /v1/customers`), then a `mode=setup` session for it. `CHARGE` opens a `mode=payment` session with `customer_creation=always` and `payment_intent_data[setup_future_usage]=off_session`. v1 only starts `CAPTURE` (ADR 0007). Both send `client_reference_id=reference`. `providerSessionRef` is the session id.
   - The checkout POSTs carry no `Idempotency-Key`. Our `reference` is the subscription id, which a payment-method update reuses (slice 11). The same key with other parameters is a Stripe `400`.
4. **Refs.** `providerSessionRef` and `providerChargeRef` are Stripe's own ids (`cs_…`, `pi_…`), already single strings. `paymentMethodToken` is opaque and owned by the adapter, as in ADR 0019 decision 2: JSON `{ kind: 'stripe.card', customer, paymentMethod }`. A token the adapter did not issue is refused before any call.
5. **Webhooks are not verified, and need not be for v1.** `checkout.session.completed` maps to `CHECKOUT_COMPLETED`; everything else is `UNRECOGNIZED`. Trust comes from `verifyCheckout` re-fetching the session from Stripe, the same model as Grow (webhook-trust rule 3). `signedWebhooks` is `false` until the port passes headers to `parseWebhook`. That port change, and verifying `Stripe-Signature` against the connection's signing secret, is a follow-up.
   - The endpoint is configured in the Stripe dashboard, not sent per request, so `notifyUrl` is not used. Its shape is `<PUBLIC_BASE_URL>/v1/webhooks/stripe/<providerConnectionId>`.
6. **Charges.** `POST /v1/payment_intents` with `off_session=true`, `confirm=true`, `metadata[dedup_key]`, `metadata[charge_serial]`, and `Idempotency-Key = dedupKey`, so a retry after a timeout charges once. `succeeded` is `succeeded`. A `402 card_error` is `failed`, carrying `error.payment_intent.id` and the decline code. Anything else throws and the charge stays `pending` (ADR 0017), as in ADR 0019 decision 5.
7. **Lookups.** `verifyCharge` reads the PaymentIntent by id, or searches `metadata['dedup_key']` when no ref was stored. `succeeded` is `SUCCEEDED`; `requires_payment_method` and `canceled` are `FAILED`; any other status is `PENDING`; an empty search is `NOT_FOUND`. Search is eventually consistent (about a minute), so a charge made seconds ago can read `NOT_FOUND`. Reconcile's grace window (ADR 0017) is longer than that, and a retry reuses the dedup key, which Stripe's idempotency answers with the first PaymentIntent.

## Consequences

- `payment_provider` gains `stripe` (a migration adds the enum value).
- Capabilities: self-managed schedule, card-only save, lookup by reference; no signed webhooks or refunds yet.
- Off-session SCA (`authentication_required`) is an ordinary `402` decline here and runs dunning. Slice 22 still owes the decision on whether it is a distinct reason.
- Every request pins `Stripe-Version: 2026-09-30.endive`, so a change to the account default cannot reshape the replies the zod parsers expect. Moving to a newer version is a deliberate change that updates the fixtures. Endive removed `payment_method_types` from Checkout Sessions; we never send it.
