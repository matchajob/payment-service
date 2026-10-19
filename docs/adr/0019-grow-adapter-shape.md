# ADR 0019: Grow adapter: a charge serial, opaque refs, and the payer from Grow's page

**Status:** Accepted, 2026-10-17
**Slice:** 13. The wire facts behind it are in `.claude/skills/grow/SKILL.md`.

## Context

Reading Grow's Light API against our `PaymentProvider` port turned up four mismatches.

1. **Grow's idempotency key is an integer.** `createTransactionWithToken` takes `transactionUniqueIdentifier`, a positive integer of at most 4294967295. Grow rejects a value the business has used before, even when the first request failed. Our `dedupKey` is a string (`subscriptionId:periodEnd:attempt`).
2. **Grow identifies things by pairs.** A checkout session is `processId` + `processToken`, and a charge is `transactionId` + `transactionToken`. To charge a saved card again, Grow needs the `cardToken` plus the payer's full name and phone. Each port field that holds one of these is a single string.
3. **The payer's name and phone are required** on a token charge, and are documented as required on `createPaymentProcess` too. A customer row holds only `externalRef`.
4. **`apiKey` belongs to the integrator, not the merchant.** It identifies us as a platform. Each merchant has its own `userId` and `pageCode`.

## Decision

1. **A charge serial, written to the intent row.** `charges` gains `chargeSerial`, a `bigint` identity column (`makeDzdBigIdentity`, the only identity helper in `@matcha/infra`; TypeScript type `bigint`). The adapter refuses a serial above 4294967295, Grow's ceiling. Each attempt's row is inserted before the provider call (ADR 0008), so the serial is always known before the call and again at reconcile. `ChargeRequest` and `VerifyChargeRequest` carry it. Grow sends it as `transactionUniqueIdentifier`. It looks up a charge that timed out with `getTokenTransactionsByExternalIdentifiers(cardToken, serial)`. `VerifyChargeRequest` also carries `paymentMethodToken`, because that lookup needs the card.
   - Rejected: hashing `dedupKey` to 32 bits. It needs no schema change, but by the birthday bound a merchant with 10k charges has about a 1% chance of a collision, and the odds keep growing. A collision makes Grow reject a legitimate charge outright.
2. **Refs are opaque and owned by the adapter.** The port keeps its string fields. Inside `providerSessionRef`, `providerChargeRef` and `paymentMethodToken`, the Grow adapter encodes what it needs to call Grow again. The encoding must be canonical: `parseWebhook` has to produce the same `sessionRef` that `startCheckout` returned for the same process, whether Grow sent `processId` as a string or a number. Otherwise `completeCheckout` ignores the webhook. A ref the adapter did not issue is refused before any call.
   - Rejected: structured port fields. Every adapter and every call site would carry Grow's shape.
3. **The payer's name and phone come from Grow's page.** The payer types them on Grow's hosted page. `verifyCheckout` reads them back from `getPaymentProcessInfo`, together with the card token, and folds them into the opaque `paymentMethodToken`. The tenant API is unchanged.
   - This depends on the sandbox confirming that the page asks for the fields when we leave them out. If it doesn't, the fallback is for the tenant to send the payer's name and phone at subscription creation, which is a contract change.
   - The cost: the `payment_methods.providerToken` column now holds the payer's name and phone. They are personal data, but they are exactly what a charge needs.
4. **Connection credentials are `{ userId, pageCode }`.** `apiKey` is app config, sent on every request once we are a registered Grow platform, and absent before then.
5. **Failures split into refused and ambiguous.** A reply that is the envelope with `status 0` means Grow answered and nothing was charged: `charge` returns `failed` with Grow's message. Anything else throws, so the charge stays `pending` for reconcile. That covers a non-envelope body, a non-200 status, a network error, a timeout, and a `status 1` reply that isn't `paid`.
   - The lookups (`verifyCheckout`, `verifyCharge`) throw on any refusal. `NOT_FOUND` and `NOT_COMPLETED` come only from an explicit empty or unpaid answer. A lookup that fails must never read as "nothing was charged", because reconcile acts on `NOT_FOUND` by retrying.

## Consequences

- A migration adds `charges.chargeSerial`. The four charge call sites (first charge, renewal and dunning through the charge cycle, the card-update retry) and `verifyRequestFor` pass it on.
- `statusCode 11` ("suspended") is the only status that proves a card was saved. A row that charged instead (`2`) is not a save.
- The open sandbox questions are listed in the skill and in WORKPLAN slice 13. The sandbox run may overturn decision 3, and may change which error code means "not found".
- Slice 25 builds its refused-versus-ambiguous split on decision 5.
