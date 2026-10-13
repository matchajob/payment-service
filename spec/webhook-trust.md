# Spec 4 — Inbound Webhook Trust & Reconciliation

Covers webhooks arriving from providers (card gateways, store adapters) at `/v1/webhooks/:provider/:tenantSlug`. Founding rule: a webhook is a trigger to verify, never a fact.

## Rules

| # | Rule |
|---|---|
| 1 | Persist first, interpret second: raw payload stored to `webhook_events` with a dedup key before any processing; duplicates process once |
| 2 | Money is never read from a webhook body: recorded amounts come from our plan row, never the payload |
| 3 | Unsigned sources (e.g. Grow): a webhook may only trigger verification; charge success is recorded solely after the provider's verify API confirms it |
| 4 | Signed sources (e.g. RevenueCat/Apple/Google): a verified signature is sufficient to drive state transitions (D11); rule 2 still applies to amounts |
| 5 | Failed signature verification → reject, log, no state effect |
| 6 | Ack semantics follow retryability: garbage/unknown payload → `200` + log (provider retry helps nothing); transient internal failure → `5xx` so the provider retries |
| 7 | Webhooks obey the lifecycle table (Spec 1): only listed transitions, `canceled` is a firewall, no state skipping |
| 8 | Nightly reconcile: every unsettled charge gets `verifyCharge` against the provider — the safety net for lied-about, missed, or dropped events |

## Decision log

- **D11** signature verification suffices for state changes from signed sources; provider-API verification is required only where no signature exists. Amounts are never webhook-sourced in either case.
