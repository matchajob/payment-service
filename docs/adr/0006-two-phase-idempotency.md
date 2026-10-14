# ADR 0006: Idempotency is two-phase, a thrown handler releases its key, and the key is required

**Status:** Accepted, 2026-10-14
**Slice:** 2

## Context

Spec 3 rule 1 says the reservation and the handler's mutations commit in one transaction. Rule 4 says a duplicate arriving while the first attempt is in flight gets `409` immediately, and D9 forbids waiting. Read literally, the two collide. A `reserved` row inserted inside the handler's open transaction is invisible to every other connection, and a concurrent `INSERT` of the same `(tenant, key)` blocks on the unique index until that transaction ends. That block is the hold-and-wait D9 rejects.

Two shapes avoid the block:

- a. Two phases. Phase 1 commits a `reserved` row in its own short transaction. Phase 2 runs the handler and marks the key `completed` with the stored response, in one transaction.
- b. One transaction guarded by `pg_try_advisory_xact_lock` on the key, so a concurrent duplicate fails the lock and gets `409` without waiting.

Spec 3 also says error responses are stored and replayed, and it does not say whether a mutation may omit the key.

## Decision

- **Two phases (a).** Rule 1 is read as "the handler's mutations and the key's completion commit together". The reservation commits first so other requests can see it.
- A crash between the phases leaves a `reserved` row whose handler transaction rolled back, so it has no side effects. Rule 5's 90-second takeover is exactly that case, which is why the spec can call it safe.
- **A handler that throws releases its key.** Phase 2 has rolled back, so the reservation is deleted and the next request with that key executes again. Responses with a status below 500, including `4xx` problem responses, are stored and replayed. That is how "error responses are stored" is read.
- **The key is required** on every `/v1` mutation. Missing or not a UUID is `400` problem+json, and nothing is reserved.
- The body hash is SHA-256 over the raw request bytes, captured in phase 1.
- Staleness (rule 5) is measured against the injected clock, never against `now()` in SQL, so tests control time.

## Consequences

- Slice 4's provider call fits between the phases, as the slice 4 note requires: the reservation is visible, the provider is called with no transaction open, and phase 2 records the result.
- Handlers get their database handle from the request context (`c.get('db')`), never from a closure, so their writes go through phase 2's transaction.
- A transient outage costs the tenant one `500` and a retry, not a key that replays the `500` for 24 hours.
- Shape (b) stays available if a future handler needs strict single-transaction semantics and has no external call.
