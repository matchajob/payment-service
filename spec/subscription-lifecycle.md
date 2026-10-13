# Spec 1 — Subscription Lifecycle

Behavior spec. Schema and code derive from this file, not the reverse.
Any state×event pair absent from the transition table is rejected: API mutations → `409` problem+json; webhooks → logged no-op.

## States

| State | Meaning | Entitled |
|---|---|---|
| `incomplete` | Created; first payment not yet observed | no |
| `active` | Paid through `currentPeriodEnd` | yes |
| `past_due` | Renewal failed; dunning in progress | per tenant policy (`graceEntitlement`) |
| `canceled` | Terminal; no resurrection | no |

- Pending cancellation is a flag (`cancelAtPeriodEnd`) on `active`/`past_due`, not a state.
- The contract exposes computed `entitled: boolean` beside `status`; apps never derive entitlement themselves.

## Transitions — `scheduleOwner: self`

| # | From | Event | To | Effects |
|---|---|---|---|---|
| 1 | — | `create` (API) | `incomplete` | start hosted checkout; return `checkoutUrl` |
| 2 | `incomplete` | `checkout_completed` (webhook) | `active` | record charge #1; store payment method; period 1 starts now; emit `subscription.activated` |
| 3 | `incomplete` | `checkoutTtlHours` elapsed (cron) | `canceled` | no events emitted |
| 4 | `incomplete` | `cancel` (API) | `canceled` | immediate |
| 5 | `active` | `renewal_due` (cron), no flag, charge succeeds | `active` | advance period; emit `charge.succeeded` |
| 6 | `active` | `renewal_due`, charge fails | `past_due` | emit `charge.failed` + `subscription.past_due`; start dunning clock |
| 7 | `active` + `cancelAtPeriodEnd` | `renewal_due` | `canceled` | no charge; emit `subscription.canceled` |
| 8 | `active` | `cancel` (API) | `active` + flag | idempotent; response carries flag + effective date |
| 9 | `active` + flag | `resume` (API), `resumeAllowed` | `active`, flag cleared | — |
| 10 | `past_due` | `retry_due` (`dunningSchedule`), charge succeeds | `active` | advance period; reset dunning; emit `charge.succeeded` |
| 11 | `past_due` | final retry fails | `canceled` | emit `subscription.canceled` (`reason: payment_failure`) |
| 12 | `past_due` | `cancel` (API) | `canceled` | immediate; stop dunning; emit `subscription.canceled` |
| 13 | `active` | `update_payment_method` (API) | `active` | capture-mode checkout; on completion replace token; no charge |
| 14 | `past_due` | `update_payment_method` checkout completed | `active` / `past_due` | replace token; immediate retry; success → `active` (emit `charge.succeeded`); failure → stay `past_due`, dunning clock resets |
| 15 | `canceled` | any API mutation | — | `409` |
| 16 | `canceled` | any webhook | — | logged no-op |

- Webhook replays are idempotent: at most one payment method per capture, at most one charge per dedup key (`subscriptionId:periodEnd:attempt`).
- Re-subscribe after `canceled` = new subscription row; customer row persists across subscriptions.

## Transitions — `scheduleOwner: external` (Apple / Google via store adapter)

Same states; event sources and permissions invert:

- Rows 2, 5, 6, 10, 11 are driven by store notifications (normalized by the adapter), never by our cron. Store grace/retry maps onto `past_due`; store expiry/revocation onto `canceled`.
- Rows 8, 9, 12, 13 (cancel / resume / card update via our API) → `409`; the store owns them. Apps surface a manage-in-store link.
- Charges are recorded as observed ledger entries (`source: external`); the service never initiates them.
- Tenant policy knobs below do not apply to external subscriptions.

## Double-charge guards

- Charge execution is serialized per subscription: it runs in a transaction holding the subscription row lock, and after acquiring the lock re-verifies status and that the period is still unpaid **before** contacting the provider. Applies equally to renewal (row 5), dunning retries (row 10), and the immediate retry (row 14).
- A row-14 immediate retry supersedes the pending scheduled dunning retry; the old schedule never fires alongside it.
- At most one `succeeded` charge per (subscription, `periodEnd`) — enforced by a partial unique index as a tripwire behind the serialization guard.
- Row 13/14 capture-mode checkout saves a token only; it never charges. The retry is a separate, guarded charge.
- Every provider charge carries the cycle dedup key (`subscriptionId:periodEnd:attempt`) so the provider rejects replays of the same attempt; external-mode observed charges dedup on the store transaction id.

## Tenant billing policy

Per-tenant config; defaults are the ratified values:

| Knob | Default | Applies to |
|---|---|---|
| `checkoutTtlHours` | 12 | row 3 |
| `resumeAllowed` | true | row 9 |
| `graceEntitlement` | true | `past_due` entitlement |
| `dunningSchedule` | +1d, +3d, +7d after failure | rows 10–11 |

## Decision log

- **D1** checkout TTL 12h default, per-tenant.
- **D2** un-cancel in v1, per-tenant switch.
- **D3** dunning per-tenant (`dunningSchedule`); default Spotify-style: grace entitlement + retries over ~1 week, then cancel; post-cancel downgrade semantics are the tenant app's concern.
- **D4** grace entitlement per-tenant; exposed via computed `entitled`.
- **D5** card-update flow in v1; the `past_due` rescue path (row 14).
- **D6** `canceled` is terminal: resume covers pre-expiry regret; new-row re-subscribe keeps current pricing; immutable lifecycles keep history queryable; terminal state firewalls replayed/unsigned webhooks.
