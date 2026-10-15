# Payment Service – Product Requirements Document

**Version:** v1 API
**Status:** Draft
**Date:** 2026-10-13
**Sources:** `payment service spec (1).docx` (this repo) and the behavior specs with decision log D1–D13 in `job-platform/payments-service/spec/`. Where the two differ, the decision log wins and is cited inline.

---

## 1. Overview

The payment service manages recurring subscriptions on behalf of multiple tenants. It owns the subscription state machine, schedules and executes renewal charges, deduplicates requests via idempotency keys, ingests webhooks from payment providers, and emits signed webhooks to tenants describing every state change.

The first tenant is the job-platform app. The first provider is Grow (card gateway, unsigned webhooks). RevenueCat (store adapter for Apple and Google, signed webhooks) is designed for in the port and schema but deferred to v2.

### 1.1 Goals

- Provide a single, predictable subscription lifecycle shared by API calls, cron jobs, and provider webhooks.
- Charge customers on an anniversary-based schedule, never early, and never trusting amounts from external payloads.
- Guarantee at-most-once execution for retried requests and provider webhook redeliveries.
- Deliver state changes to tenants at least once, in a self-describing and ordered form, so tenant apps never depend on service uptime to interpret an event.

### 1.2 Out of Scope (v1)

- Plan upgrades, downgrades, and proration.
- Trials.
- Multi-currency per tenant. v1 is ILS only.
- Hard-decline short-circuiting. All failures run the full dunning schedule; the raw reason is stored for later.
- Resurrecting a canceled subscription. Resubscription is a new row.
- Alerting or automation around dead-letter events (D13).
- Post-cancel downgrade behaviour in the tenant application (see 1.3).
- The RevenueCat adapter and external mode (section 2.3). Decided 2026-10-14. `scheduleOwner` and the provider capability flags stay in the schema and port so v2 adds an adapter, not a migration of the core.

### 1.3 Product Constraints and Consequences

- **One plan per tenant.** Because upgrades, downgrades, and trials are out of scope, the first job-platform integration can sell exactly one plan per tenant. A customer who wants a different plan must cancel and resubscribe as a new row.
- **Post-cancel downgrade is the tenant's job.** When a subscription reaches `canceled`, or `entitled` becomes `false` in an outbound event, the service only reports the fact. What the customer loses, and when, is decided and enforced by the tenant application (D3). This is the open **PRODUCT:HIGH** item for this repo and is not yet tracked anywhere in it.
- **Entitlement is computed by the service.** The contract exposes `entitled: boolean` beside `status`. Tenant apps never derive entitlement themselves (D4).

---

## 2. Subscription Lifecycle

Any state and event pair absent from the transition table is rejected: API mutations return `409` problem+json, webhooks are logged as a no-op.

### 2.1 States

| State | Meaning | Entitled |
|---|---|---|
| `incomplete` | Created; first payment not yet observed. | no |
| `active` | Paid through `currentPeriodEnd`. | yes |
| `past_due` | Renewal failed; dunning in progress. | per tenant `graceEntitlement` |
| `canceled` | Terminal. No resurrection. | no |

**`cancelAtPeriodEnd`** is a boolean flag, not a state. It rides on `active` or `past_due` and means the subscription will not renew at the end of the current period.

### 2.2 State Machine (`scheduleOwner: self`)

| # | From | Event | To | Effects / Notes |
|---|---|---|---|---|
| 1 | – | `create` (API) | `incomplete` | Start hosted checkout; return `checkoutUrl`. |
| 2 | `incomplete` | `checkout_completed` (webhook) | `active` | Record charge #1; store payment method; period 1 starts now; emit `subscription.activated`. |
| 3 | `incomplete` | `checkoutTtlHours` elapsed (cron) | `canceled` | Housekeeping. No event emitted. |
| 4 | `incomplete` | `cancel` (API) | `canceled` | Immediate. |
| 5 | `active` | `renewal_due` (cron), charge succeeds | `active` | Advance period; emit `charge.succeeded`. |
| 6 | `active` | `renewal_due`, charge fails | `past_due` | Emit `charge.failed` and `subscription.past_due`; start dunning clock. |
| 7 | `active` + flag | `renewal_due` | `canceled` | No charge; emit `subscription.canceled`. |
| 8 | `active` | `cancel` (API) | `active` + flag | Idempotent. Response carries flag and effective date. |
| 9 | `active` + flag | `resume` (API), `resumeAllowed` | `active`, flag cleared | |
| 10 | `past_due` | `retry_due` (dunning), charge succeeds | `active` | Advance period from original `periodEnd` (D7); reset dunning; emit `charge.succeeded`. |
| 11 | `past_due` | final retry fails | `canceled` | Emit `subscription.canceled` with `reason: payment_failure`. |
| 12 | `past_due` | `cancel` (API) | `canceled` | Immediate; stop dunning; emit `subscription.canceled`. |
| 13 | `active` | `update_payment_method` (API) | `active` | Capture-mode checkout; on completion replace token. No charge. |
| 14 | `past_due` | `update_payment_method` checkout completed | `active` or `past_due` | Replace token; immediate retry. Success emits `charge.succeeded`. Failure stays `past_due` and resets the dunning clock. |
| 15 | `canceled` | any API mutation | – | `409`. Terminal and immutable. |
| 16 | `canceled` | any webhook | – | Logged no-op. |

**Cancel semantics are decided by state, not by the caller.** `incomplete` and `past_due` cancel immediately. `active` cancel is always flag-only. There is no `immediately` parameter.

**Assumed, not in either source:** a `past_due` + flag row that is rescued by a successful retry lands in `active` + flag and then follows row 7. A failed final retry cancels as in row 11. See Open Question 4.

### 2.3 External Mode (`scheduleOwner: external`)

Subscriptions billed by Apple or Google arrive through a store adapter (RevenueCat).

- Same four states. Rows 2, 5, 6, 10, 11 are driven by store notifications, never by our cron. Store grace maps to `past_due`, store expiry or revocation to `canceled`.
- Rows 8, 9, 12, 13 through our API return `409`. The store owns them. Apps surface a manage-in-store link.
- Charges are recorded as observed ledger entries with `source: external`. The service never initiates them.
- Tenant billing policy knobs do not apply to external subscriptions.

### 2.4 Tenant Billing Policy

| Knob | Type | Default | Applies to |
|---|---|---|---|
| `checkoutTtlHours` | `int` | 12 (D1) | row 3 |
| `resumeAllowed` | `boolean` | true (D2) | row 9 |
| `graceEntitlement` | `boolean` | true (D4) | `past_due` entitlement |
| `dunningSchedule` | `int[]` | +1d, +3d, +7d after failure (D3) | rows 10 and 11 |

### 2.5 Dunning

- The renewal is attempt 0. Dunning retries are attempts 1..N per `dunningSchedule`, offsets counted from the failed attempt 0.
- A retry fires on the first cron pass after its due moment. Day-level precision is the contract.
- If `graceEntitlement` is true the customer stays entitled throughout.
- A successful retry pays for the period that failed. The new period runs from the original `periodEnd`, not the recovery date, so grace days are covered and the anniversary never shifts (D7).
- Exhausting the schedule cancels the subscription (row 11).

### 2.6 Double-Charge Guards

- Charge execution is serialized per subscription. It runs in a transaction holding the subscription row lock and, after acquiring the lock, re-verifies status and that the period is still unpaid before contacting the provider. Applies to rows 5, 10, and 14.
- A row 14 immediate retry supersedes the pending scheduled retry. The old schedule never fires alongside it.
- At most one `succeeded` charge per (subscription, `periodEnd`), enforced by a partial unique index as a tripwire behind the serialization guard.
- Capture-mode checkout (rows 13 and 14) saves a token only. It never charges.
- Every provider charge carries the dedup key `subscriptionId:periodEnd:attempt` so the provider rejects replays of the same attempt. External observed charges dedup on the store transaction id.

### 2.7 Resubscription

A canceled subscription is never reactivated (D6). A customer who subscribes again gets a new subscription row at current pricing. The customer row persists across subscriptions.

---

## 3. Charging

### 3.1 Period Anchoring

- Period 1 starts at activation. Renewal is anniversary based: activated on the 14th bills on the 14th.
- Month-length clamp with a persistent anchor day. Jan 31 → Feb 28 → Mar 31. The anchor day must be stored, otherwise it drifts after the first clamp.
- All timestamps are UTC.

### 3.2 Due Detection

- Daily cron. Due means `active` and `currentPeriodEnd` in the past.
- Charge at expiry, never before. No pre-billing.
- The row stays `active` while the attempt runs and flips to `past_due` only on a known failure. Cron lag never interrupts entitlement.
- Period advancement is from the previous boundary, never from wall-clock time:

  ```
  newPeriodEnd = oldPeriodEnd + interval      // correct
  newPeriodEnd = now + interval               // wrong, drifts with cron lag
  ```

### 3.3 Plans and Amounts (D8)

- Plans are immutable. A charge always uses the amount on the subscription's plan row.
- A price change is a new plan row. Existing subscribers stay on their row until the tenant explicitly migrates them. Live subscribers can never be repriced by an UPDATE.

---

## 4. Idempotency

Applies to every `/v1` mutation. Callers mint one `Idempotency-Key` (UUID) per intent. Scope is `(tenant, key)`, so two tenants may send the same key.

### 4.1 Key States

| State | Meaning |
|---|---|
| `reserved` | Request accepted; work in flight. |
| `completed` | Response stored. |

### 4.2 Rules

| # | Situation | Behaviour |
|---|---|---|
| 1 | New key | Reserve and execute. Reservation, handler mutations, and stored response commit in one transaction. |
| 2 | Replay of completed key, same body | Return the stored response verbatim. No re-execution. |
| 3 | Same key, different body (hash mismatch) | `422`. One key means one intent. |
| 4 | Same key while first attempt in flight | `409` with `Retry-After: 1`. Never wait on another request's fate (D9). |
| 5 | Key stuck `reserved` longer than 90s | Considered dead. Next replay may re-reserve and re-execute. Safe because rule 1 means a crash left no side effects. |
| 6 | Completed key older than 24h | Purged by cron. The key becomes new again (D10). |

- Error responses are stored and replayed like successes. A `422` replays as the same `422`.
- Nothing is reserved when authentication fails.
- The body hash is captured at reservation time.
- Provider calls that cannot be rolled back, such as starting a checkout, must not run inside the reservation transaction.

---

## 5. Inbound Webhooks (Provider → Service)

Route: `/v1/webhooks/:provider/:tenantSlug`. Founding rule: a webhook is a trigger to verify, never a fact.

### 5.1 Provider Capabilities

Each provider adaptor declares its capabilities:

```ts
export interface ProviderCapabilities {
  selfManagedSchedule: boolean;      // the service runs the renewal cron
  providerManagedSchedule: boolean;  // the provider (app store) owns the schedule
  signedWebhooks: boolean;           // webhooks are cryptographically signed
  refunds: boolean;                  // provider supports refunds
  saveCardWithoutCharge: boolean;    // checkout can store a card token with no charge (ADR 0007)
}
```

The first checkout saves the card and charges nothing. Charge #1 runs after the subscription is activated, so a customer can never pay twice for one live subscription (ADR 0007). In v1 the service refuses to start with a self-managed provider that lacks `saveCardWithoutCharge`.

### 5.2 Rules

1. **Persist first, interpret second.** Store the raw payload to `webhook_events` with a dedup key before any processing. Duplicates process once.
2. **Money never comes from the payload.** Recorded amounts come from the plan row, never the webhook body.
3. **Unsigned sources (Grow)** may only trigger verification. Charge success is recorded solely after the provider's verify API confirms it.
4. **Signed sources (RevenueCat, Apple, Google).** A verified signature is sufficient to drive state transitions (D11). Rule 2 still applies.
5. **Bad signature:** reject, log, no state effect.
6. **Ack semantics follow retryability.** Garbage or unknown payload returns `200` with a log line, because a provider retry helps nothing. Transient internal failure returns `5xx` so the provider retries.
7. **Shared state machine.** Webhooks obey the lifecycle table. Only listed transitions, `canceled` is a firewall, no state skipping.
8. **Nightly reconcile.** Every unsettled charge gets `verifyCharge` against the provider. This is the safety net for lied-about, missed, or dropped events.

---

## 6. Outbound Webhooks (Service → Tenant)

Event kinds: `subscription.activated`, `subscription.past_due`, `subscription.canceled`, `charge.succeeded`, `charge.failed`.

### 6.1 Rules

1. **Same DB transaction.** The outbox row commits with the state change it describes. No state change exists without its event.
2. **At-least-once delivery.** A drainer cron claims pending events with `FOR UPDATE SKIP LOCKED`, POSTs to the tenant `webhookUrl`, marks delivered on 2xx, and retries with exponential backoff otherwise.
3. **Fat events (D12).** Each event carries a full subscription snapshot: `status`, `entitled`, `currentPeriodEnd`, plan ref, plus a per-subscription sequence number.
4. **Sequence numbers.** Receivers apply a snapshot only if its sequence exceeds the stored one. Stale or duplicate arrivals are no-ops keyed by event id. Order of arrival never matters.
5. **Signing.** HMAC-SHA256 over `timestamp.body` with the per-tenant webhook secret, sent as `Payments-Signature` and `Payments-Timestamp` headers.
6. **Dead letter after 8 failed attempts.** Retries stop, the last error is retained, the row stays queryable.
7. **Dead-letter handling v1 (D13).** A manual redrive script re-queues after the receiver is fixed. Loud in logs, no automated paging.

### 6.2 Receiver Contract (implemented in each tenant app)

- Verify the HMAC. Reject timestamps older than 5 minutes.
- Respond 2xx before heavy processing. Ack fast, process after.
- Dedup by event id. Upsert the mirror by sequence (rule 4).
- Never call back into the payment service to interpret an event. The snapshot is the data.

---

## 7. Technical Decisions

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript, strict | The first tenant is TypeScript, so the zod contract is shared across the wire with no hand copy. The `@matcha/infra` DZD layer makes one field declaration produce validator, column, and type, which removes schema drift. |
| Runtime and HTTP | Node, Hono | Hono stays in `src/api` only. `src/lib` may not import it. |
| Database | Plain Postgres via Drizzle. Supabase is the host, not a dependency. | Keeps the service swappable to RDS. Imports from `@supabase/*` are lint errors. |
| Validation | Zod 4 via `@matcha/infra/domain-zod` | One zod instance across service and tenant. |
| Contract layer | `src/contract`, zod-only, published to tenants | May import only zod and other contract files. Enforced by lint. |
| Layering | `infra` → `lib` → `api`, absolute imports only | Portability rule from job-platform. `infra` never imports domain code. |
| Tests | vitest, test-first at agreed seams | Tests live in `tests/` directories, never beside source. |
| Infra access | `@matcha/infra/*` resolves to `job-platform/src/infra` via tsconfig paths | No duplicate zod or drizzle instances. On extraction to a standalone repo, restore the pinned git-dependency pattern. |
| Providers | Grow (card, unsigned) and RevenueCat (store, signed) behind a `PaymentProvider` port | Capabilities declared per adaptor (5.1). |

The nested subrepo at `job-platform/payments-service` holds the behaviour specs, decision log, and reconciliation audit. That audit is the ordered work list for the rebuild.

---

## 8. Open Questions

1. **`resumeAllowed = false` response.** Not stated in either source. Assumed `409`, consistent with other disallowed transitions.
2. **Anchor-day storage.** Spec 2 requires a persistent anchor day. Neither source names the column or where it is set. Needs a schema decision before row 5 is built.
3. **Refunds.** `refunds` is a declared provider capability but no refund flow or state effect is described.
4. **`past_due` + `cancelAtPeriodEnd`.** Neither source has a row for a flagged `past_due` subscription. The likely behaviour is that a successful retry lands in `active` + flag and cancels at the next renewal cron. That may not be intended: the customer asked to cancel, their paid period has ended, and the retry charges them for a period they will then cancel out of. Decide between (a) retry and land in `active` + flag, or (b) skip dunning and cancel immediately. Section 2.2 assumes (a).
5. **Post-cancel downgrade (PRODUCT:HIGH).** See 1.3. The tenant app owns what happens to a customer after cancellation. Needs a product decision and a tracking item in this repo.
6. **Providers without `saveCardWithoutCharge`.** v1 refuses them at boot (ADR 0007). Supporting them needs a fallback: charge at checkout, answer `409` at create for an already-live customer, and on an activation conflict cancel and refund (or flag a manual refund when the provider has no `refunds`). Blocked on the refund flow, which is out of scope for v1.
7. **First charge declined after the card was saved.** Resolved 2026-10-16 (ADR 0008): cancel immediately and emit `charge.failed` with a `canceled` snapshot. The customer starts a new checkout.

Resolved since the first draft by the decision log: checkout TTL default is 12h per tenant (D1), dead-letter threshold is 8 attempts, completed idempotency keys purge after 24h (D10), dunning default is +1d/+3d/+7d (D3).

---

## Appendix: Decision Log Reference

| ID | Decision |
|---|---|
| D1 | Checkout TTL 12h default, per tenant. |
| D2 | Un-cancel (resume) in v1, per-tenant switch. |
| D3 | Dunning per tenant. Default: grace entitlement plus retries over about a week, then cancel. Post-cancel downgrade is the tenant app's concern. |
| D4 | Grace entitlement per tenant, exposed via computed `entitled`. |
| D5 | Card-update flow in v1. The `past_due` rescue path is row 14. |
| D6 | `canceled` is terminal. Resume covers pre-expiry regret. New-row resubscribe keeps current pricing. Immutable lifecycles keep history queryable. Terminal state firewalls replayed or unsigned webhooks. |
| D7 | Recovered subscriptions bill from the original `periodEnd`. Continuous coverage, fixed anniversary. |
| D8 | Plans immutable. Repricing is migration, not mutation. |
| D9 | Concurrent duplicate request returns `409` with `Retry-After`, never hold-and-wait. |
| D10 | Idempotency replay window 24h, cron purged. |
| D11 | Signature verification suffices for state changes from signed sources. Provider API verification only where no signature exists. Amounts are never webhook-sourced. |
| D12 | Fat events with per-subscription sequence. Thin notify-and-fetch rejected because it reintroduces runtime coupling. |
| D13 | Dead letter is keep plus manual redrive in v1. Alerting deferred until an ops surface exists. |
