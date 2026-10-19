---
name: grow
description: Use when working on the Grow (formerly Meshulam) payment adapter, slice 13, or anything that calls, parses or fakes Grow's Light API, such as "grow adapter", "meshulam", "createPaymentProcess", "createTransactionWithToken", "cardToken", "notifyUrl", "getPaymentProcessInfo", "approveTransaction", "Grow webhook", "Grow decline", "Grow sandbox", "recorded Grow responses", "transactionUniqueIdentifier". Holds the wire facts, the quirks, how Grow maps onto our PaymentProvider port, and what is still unconfirmed.
---

# Grow Light API

Grow is the v1 card provider. It is unsigned and self-managed: we own the schedule and charge a saved token, and Grow never bills on its own. This file is what we know about the wire. [wire-examples.md](wire-examples.md) has recorded bodies to build fixtures from.

Facts are labelled. **[C]** means confirmed in Grow's docs, its Postman collection or a probe of our own. **[3P]** means a third party observed it on the wire. **[?]** means unconfirmed: settle it in the sandbox before code depends on it, then update this file. Researched on 2026-10-17 from `developers.grow.business`; add `.md` to any page URL to get its markdown.

## Transport [C]

- **Base URLs.** Sandbox `https://sandbox.meshulam.co.il/api/light/server/1.0/`, production `https://secure.meshulam.co.il/api/light/server/1.0/`. Every call is `POST <base><method>`. Browsers are blocked, so calls are server only.
- **Request body.** Always `multipart/form-data`, never JSON. Nested fields use PHP bracket keys: `pageField[fullName]`, `productData[0][price]`.
- **Response.** HTTP 200 even on failure, with content type `text/html`. The body is JSON in an envelope: `{ status, err, data }`.
  - **Success:** `status` is `1`, `err` is `""`, and `data` is an object.
  - **Failure:** `status` is `0`, `err` is `{ id, message }`, and `data` is `""`.
  - `status` and `err.id` come back as numbers or as strings, depending on the endpoint. Parse leniently, coercing both.
  - `message` is Hebrew, and its wording differs between the docs and the wire. **Never branch on the message text.** Branch on `err.id`, and store the message only as a reason.
- **Unknown method.** Returns `{"err":"unknown method","status":"0"}`. Here `err` is a string, not an object.
- **Not JSON.** Traffic passes through Imperva, so an HTML block page can arrive with no envelope at all. Treat any body that isn't the envelope as an ambiguous failure, never as a decline. See "Failure classes".
- **Limits.** No rate limits, timeouts or `429` behaviour are documented. Ask Grow (slice 25).

## Credentials [C]

| Field | Scope | Sent on |
|---|---|---|
| `userId` | per merchant (business) | createPaymentProcess, createTransactionWithToken, getTokenTransactionsByExternalIdentifiers, refundTransaction |
| `pageCode` | per merchant payment page. A merchant may have several: card, Bit and so on | createPaymentProcess, getPaymentProcessInfo, getTransactionInfo, approveTransaction |
| `apiKey` | **per integrator (us, the platform)**, not per merchant | every request, once we are a registered platform |

The first two belong in the connection's sealed credentials. `apiKey` is ours: it's app config, the same for every connection. Grow's platform terms also offer `companyCommission`, a fixed ILS amount per transaction that Grow collects for the platform. That requires a commercial agreement, and it is a possible way to bill our fee.

Sandbox and production credentials are separate. Grow support issues sandbox ids. Production ids come after Grow reviews our logs. The review checks that we return 200 to notifies, and that the customer actively ticks a checkbox before a card is saved.

## The calls we use

### Save a card, no charge: `createPaymentProcess` [C]

- **Fields:** `pageCode`, `userId`, `chargeType=3` (create token), `saveCardToken=1`, `sum=1`, `successUrl`, `cancelUrl`, `notifyUrl`, `description`, `cField1`…`cField9`.
  - `sum` is "required, must be 1". Postman sends other amounts, so whether a sum other than 1 is accepted is **[?]**.
- **`notifyUrl` is per request.** So `/v1/webhooks/grow/:providerConnectionId` works with no account setting (ADR 0010 decision 4).
- **`pageField[fullName]`** (at least two words) and **`pageField[phone]`** (an Israeli mobile) are documented as required. Whether the hosted page asks the payer for them when we leave them out is **[?]**.
- **Response:** `data.url` (valid for **10 minutes**), `data.processId`, `data.processToken`. Both ids together identify the session. Never show them to the payer.
- **Success redirect:** goes to `successUrl` with `&response=success` and the cFields appended, and no transaction data. Don't trust the redirect. The notify, followed by our own lookup, is what counts.
- **Does `sum=1` place a 1 ILS hold, or nothing at all? [?]** The callback reports `statusCode 11` ("suspended"), the same code as a J5 hold.
- **No `approveTransaction` for a token-only save.**

### Charge a saved card: `createTransactionWithToken` [C]

- **Fields:** `userId`, `cardToken`, `sum`, `description`, `paymentType=2` (regular), `paymentNum=1`, `pageField[fullName]`, `pageField[phone]`, `cField1..9`, `transactionUniqueIdentifier`.
  - `paymentNum` is documented as optional but is required on the wire [3P].
- **`transactionUniqueIdentifier` is Grow's idempotency key.** A second request with a value already used by the business is rejected outright, whatever happened to the first request, including when the first one failed.
  - It must be a positive integer, at most 4294967295, with no leading zeros. Anything else returns `1013` [3P]. A missing value returns `104` [3P].
  - The error code returned for a duplicate is **[?]**. Possibly `712`, "already carried out".
  - So our string `dedupKey` can't be sent as is. Every attempt needs its own collision-free integer.
- **Success:** `data.statusCode 2` ("paid"). The response also carries `transactionId`, `transactionToken`, `asmachta` (the card company's approval number), `cardSuffix`, `sum`.
- **Decline:** the failure envelope. The reason is in `err.message`, and `err.id` is coarse. Grow labels some declines final; on a final decline, stop charging that token.

| `err.id` | Meaning | Final |
|---|---|---|
| 103 | expired, stolen or blocked card (told apart only by the message) | yes |
| 103 | card company did not approve | no |
| 451 / 452 / 453 | card inactive, blocked by the issuer, or a system block | yes |
| 140 | invalid token | yes |

Hard-decline short-circuiting is out of scope for v1. Every decline runs dunning.

- **3DS does not apply** to token charges, which are recurring and merchant-initiated.
- **No `approveTransaction`** for token charges either.

### Look up a session: `getPaymentProcessInfo` [C]

Takes `pageCode`, `processId` and `processToken`. Returns `data.transactions[]` with `statusCode`, `cardToken` and `customField`. An unpaid process returns one zeroed row (`statusCode "0"`, `transactionId "0"`). This is how `verifyCheckout` proves a save that an unsigned notify only claimed (webhook-trust rule 3).

### Look up a charge: `getTransactionInfo` and `getTokenTransactionsByExternalIdentifiers` [C]

- **`getTransactionInfo`** takes `pageCode`, `transactionId` and `transactionToken`. It is for when we have Grow's reference.
- **`getTokenTransactionsByExternalIdentifiers`** takes `userId`, `cardToken` and **one of** `transactionUniqueIdentifier` / `transactionGroupIdentifier`. It's the only lookup keyed on our own identifier, and so the one reconcile needs for a charge that timed out with no reference (ADR 0017). Its response shape is **[?]**: Grow shows no example.
- There is **no lookup by cField.**
- Grow says to use lookups only by exception. Our hourly reconcile on pending rows fits that.

### Notify (inbound webhook) [C]

- **Format:** a POST of `application/x-www-form-urlencoded` with bracket keys: `status=1&data[statusCode]=11&data[processId]=…&data[customFields][cField1]=…`. It is **not JSON**.
- **Unsigned.** It may only trigger verification. Never take the token, amount or status from it as fact.
- **Retries:** if we don't answer 200, Grow retries after 10, 20 and 30 minutes, about six times in total.
  - Whether each retry is byte-identical is **[?]**. Our dedup hashes the raw body, so a retry that differs is processed twice. That's harmless, because `completeCheckout` is idempotent on the session.
- **Token in the notify:** `data[cardToken]` appears in the docs' JSON rendering but not in the one recorded wire example of a token save. It's **[?]**, which is one more reason to take the token from `getPaymentProcessInfo`.
- **Declines:** whether a notify arrives for a declined transaction depends on an account setting.

### `approveTransaction`

Required only for regular `chargeType=1` payments. v1 never uses those, so the adapter never calls it.

## Amounts and currency [C]

- **`sum` is shekels as a decimal string**, for example `"49.00"`, not agorot. Convert from `amountMinor` at the edge (ADR 0004). Responses echo `sum` as `"3"`, `"1.00"` or `120.5`; we ignore amounts coming in, except on verify.
- **ILS only.** No currency field exists. The adapter rejects `USD` explicitly (ADR 0004).
- **Statement descriptor:** not documented. `description` shows in the transaction details, but whether it reaches the cardholder's statement is **[?]**. Keep `dynamicDescriptor` out of the capabilities (ADR 0010 amendment 7).

## Failure classes (feeds slice 25)

| What came back | Class | Adapter does |
|---|---|---|
| Envelope, `status 1` | success | map `data` |
| Envelope, `status 0`, any `err` | refused: Grow answered, nothing was charged | return `failed` with `err.message` as the reason |
| Timeout, network error, non-JSON body, envelope missing | ambiguous | **throw.** The charge stays `pending` and reconcile settles it |

Never retry a token charge automatically. Each new attempt needs a new `transactionUniqueIdentifier`, and only the charge-cycle engine creates attempts.

## Mapping to our port

Shape decided in ADR 0019:

- **Charge serial.** `charges.chargeSerial` is sent as `transactionUniqueIdentifier`.
- **Opaque refs.** Each ref is an adapter-owned string that holds Grow's pair of ids.
- **Payer details.** The payer's name and phone are read from Grow's page at `verifyCheckout` and travel inside the `paymentMethodToken`.

| Port | Grow |
|---|---|
| `startCheckout` (CAPTURE) | `createPaymentProcess` with chargeType 3, our `reference` in a cField, a per-connection `notifyUrl` |
| `providerSessionRef` | `processId` + `processToken` |
| `parseWebhook` | parse the form body, then `CHECKOUT_COMPLETED` with reference (cField) and sessionRef |
| `verifyCheckout` | `getPaymentProcessInfo`. A row with `statusCode 11` and a `cardToken` is `CARD_SAVED` |
| `charge` | `createTransactionWithToken` |
| `providerChargeRef` | `transactionId` + `transactionToken` |
| `verifyCharge` | `getTransactionInfo` with a ref, otherwise `getTokenTransactionsByExternalIdentifiers` |

Capabilities:

- `selfManagedSchedule: true`
- `providerManagedSchedule: false`
- `signedWebhooks: false`
- `refunds: false`. The endpoint exists, but no v1 slice uses it.
- `saveCardWithoutCharge: true`, pending the sandbox
- `lookupByReference: true`, pending the sandbox

Layering: `src/infra/grow/` holds the transport (form encoding, envelope parsing, base URL from injected config) and imports nothing from `@/`. `src/lib/payments/grow*` binds it to the port.

## Sandbox [C]

- **Test cards:** `4580458045804580`, `4580000000000000`, `4580111111111121`. No documented card forces a decline.
- **Bit, Apple Pay and Google Pay have no sandbox.** They charge for real, so never test them.
- **Simulated notify:** `GET <sandbox base>updateMyUrl/?url=<ours>` sends one to our URL.
- **Gating:** sandbox runs are gated behind an env flag (WORKPLAN slice 13). Every **[?]** above is on the sandbox checklist.

## Sources

- Grow docs: https://developers.grow.business. Useful pages: `/reference/create-payment-process`, `/reference/token`, `/reference/create-transaction-with-token-4`, `/reference/server-response-1`, `/reference/errors`, `/reference/parameter-mapping`, `/changelog/unique-identifiers-for-token-transactions`.
- Postman: https://documenter.gw.postman.com/api/collections/7312873/UVeGrRaX
- Wire probes [3P]: https://github.com/m-romanowski/psp-simulators/blob/HEAD/doc/grow.md
