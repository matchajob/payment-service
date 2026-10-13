# Spec 3 — Idempotency

Applies to every `/v1` mutation. Callers mint one `Idempotency-Key` (UUID) per intent.

## Key state machine

`reserved` (request accepted, work in flight) → `completed` (response stored). Scope: (tenant, key).

## Rules

| # | Situation | Behavior |
|---|---|---|
| 1 | New key | Reserve + execute; reservation and handler mutations commit in one transaction |
| 2 | Replay of completed key, same body | Return stored response verbatim; no re-execution |
| 3 | Same key, different body (hash mismatch) | `422` — one key means one intent |
| 4 | Same key while first attempt in flight | `409` + `Retry-After: 1`; never wait on another request's fate (D9) |
| 5 | Key stuck `reserved` > 90s | Considered dead; next replay may re-reserve and re-execute — safe because rule 1 means a crash left no side effects |
| 6 | Completed key older than 24h | Purged by cron; the key becomes new again (rule 4→1) (D10) |

- Error responses are stored and replayed like successes (a `422` replays as the same `422`); nothing is reserved when auth fails.
- Body hash is captured at reservation time.

## Decision log

- **D9** concurrent duplicate → reject with `409` + `Retry-After`, not hold-and-wait: at-most-once execution is the contract, retry policy belongs to the caller, and holding turns a correctness mechanism into an infrastructure-dependent wait. Matches Stripe.
- **D10** replay window 24h, cron-purged.
