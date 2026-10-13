# Spec reconciliation audit 1 — specs (69160f0) vs code (7741962)

Verdict per spec rule: COMPLIES / DIVERGES / MISSING. Line refs are at commit 7741962.

## Complies

- Lifecycle skeleton: 4 states + `cancelAtPeriodEnd` flag; activation via checkout webhook, replay-safe (incomplete-only match + payment-method upsert `onConflictDoNothing`); renewal/past_due/flag-conversion (Spec 1 rows 2, 5-8).
- Period advancement `oldPeriodEnd + interval`, never `now + interval` (charging.ts:110-112) — also satisfies D7: a dunning rescue charges the failed period and advances from it.
- Charge at expiry, subscription stays `active` during the attempt, no pre-billing.
- Charge amount from the subscription's plan row (D8); no plan-update endpoint exists (immutability holds de facto).
- Idempotency: reserve-first, handler mutations + stored response in one tx, body-hash mismatch → reused-key problem, in-flight → conflict problem (Spec 3 rules 1-4 core).
- Webhook receiver: persist-first with dedup, `trustworthy` gate before processing (Spec 4 rules 1, 4-5).
- Outbox: same-tx enqueue everywhere; `FOR UPDATE SKIP LOCKED` claim; exp backoff; dead-letter@8; HMAC-SHA256 over `timestamp.body` with per-tenant secret (Spec 5 rules 1-2, 5-6).

## Diverges

1. **Period math bug** (period.ts:6): `setUTCMonth(+1)` overflows — Jan 31 + 1mo = Mar 3, not Feb 28. Spec 2 requires month-end clamp + persistent anchor day; no anchor column exists, so the anchor would drift after any clamp.
2. **Dunning** (dunning.ts, charging.ts:155-157): hardcoded 3 retries / 14d window, retried every daily cron pass (effectively +1d,+2d,+3d), not the per-tenant `dunningSchedule` (+1d,+3d,+7d default).
3. **Cancel semantics** (subscriptions.ts:91-113): caller-chosen `immediately` from any state. Spec: `incomplete`/`past_due` cancel is always immediate, `active` cancel is always flag-only — the state decides, not the caller. Cancel of `canceled` returns 200 with existing row; spec says 409.
4. **Thin outbox payloads** (subscriptions.ts:20-25): `{subscriptionId, customerId, planId, status}` — no full snapshot (`entitled`, `currentPeriodEnd`), no per-subscription sequence number (D12).
5. **Error responses not replayed** (idempotency.ts:49-55): non-2xx rolls back and releases the key; retry re-executes. Spec 3: errors are stored and replayed like successes.
6. **Double-charge guards partial** (charging.ts): `onConflictDoNothing` on (tenant, dedupKey) guards same-attempt races, but no per-subscription serialization with re-verify before the provider call, and no partial unique "one succeeded charge per (subscription, periodEnd)".
7. Idempotency stale takeover 60s vs spec 90s; conflict response lacks `Retry-After` header.
8. Provider `startCheckout` runs inside the idempotency tx (known; must move out for a real adapter).

## Missing

- Spec 1 row 3: checkout TTL expiry (no housekeeping cron; `checkoutTtlHours`).
- Spec 1 row 9: resume/un-cancel endpoint.
- Spec 1 rows 13-14: card-update flow (capture-mode checkout, immediate retry).
- Spec 1: charge #1 recorded at activation (activation.ts records no charge).
- Spec 1: per-tenant billing policy (tenants table has no policy fields).
- Spec 1: computed `entitled` in contract + serializers.
- Spec 1: `scheduleOwner: external` + store adapter (RevenueCat) — the whole observed mode.
- Spec 3 rule 6: 24h completed-key purge cron.
- Spec 4 rule 8: nightly `verifyCharge` reconcile.
- Spec 5: dead-letter manual redrive script.
- Grow adapter (Spec 4 rule 3 exercised only by the fake provider).

## Recommendation

The architectural skeleton (tenancy, tx discipline, outbox, port) complies; the diverges are localized and the missing items are additive. Rebuilding from zero would discard compliant infrastructure to rewrite ~the same thing. Keep the repo; work the diverges (bug #1 first — it's a live defect), then the missing list, each item verified against its spec table row.
