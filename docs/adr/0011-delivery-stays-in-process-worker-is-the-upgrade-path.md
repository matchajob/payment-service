# ADR 0011: Outbox delivery stays in the service; a worker process from the same codebase is the upgrade path

**Status:** Accepted, 2026-10-16
**Slice:** 6 (drainer), batch 3 (cron route). Extends ADR 0002 and ADR 0009.

## Context

During slice 6, Omer asked three related questions: should the outbox be a message broker (Kafka) instead of a table, should delivery be decoupled, and should the drainer be its own microservice.

### A broker can't replace the outbox write

tx2 in ADR 0008 commits the charge outcome, the subscription transition and the outbox row together. A broker can't take part in a Postgres commit. Publishing before the commit can announce a state that then rolls back. Publishing after the commit can lose the event if the process dies in between. This is the dual-write problem the transactional outbox exists to solve. So the table stays whatever happens downstream.

### A broker could replace the drainer, and fits it badly

With the table fixed, a broker could only sit after it: outbox, then a relay or CDC, then a topic, then a consumer that POSTs to the tenant. That adds two parts and replaces only the claim statement. Slice 6's rules also conflict with a log:

- Each event waits on its own timer (the ADR 0009 schedule, 5 s to 10 h). Kafka has no per-message delay, so it would need one retry topic per delay tier.
- A failing tenant mustn't block other events. Partitions are ordered, so there is head-of-line blocking.
- An attempt is counted at claim, so a crash-looping payload still reaches dead-letter. Kafka commits offsets after processing, which is ADR 0009's rejected option A.
- Dead-letter and redrive are a status column and an `UPDATE`. Pending and failed events are queryable per tenant.

SQS matches the ADR 0009 model better (visibility timeout, receive count, DLQ), but it caps delays at 15 minutes and still needs the relay.

### Cost at expected volume

Assume about 30k events a month (10k subscriptions × about 3 events). The table drainer costs nothing beyond the database already paid for. SQS stays inside its free tier. Kafka has a fixed floor of roughly $70 to $600 a month depending on how it's hosted, plus weeks of build time and permanent operations surface. Engineering time is the dominant cost for a one-person team.

### The decoupling already exists

tx2 writes a row and returns. The drainer reads rows and never calls billing code. If every tenant endpoint is down, charging and inbound webhooks carry on, and events wait as `pending`. Logical decoupling happens at the data contract, the outbox row, not at a deployment boundary.

A separate microservice would still read and write `outbox_events` in the same database. Two deployables bound to one schema is a distributed monolith: outbox migrations would need coordinated deploys, and nothing would be isolated that isn't already.

### The coupling that remains is runtime

Under ADR 0002 the drainer runs inside the API process, triggered through `/internal/cron/drain-outbox`. Slow tenant POSTs use the same process's sockets and event loop, and a tick is bounded by the request timeout.

## Decision

- **No message broker in v1.** The `outbox_events` table is the queue, as ADR 0009 describes.
- **No separate microservice.** Delivery stays in this service and this database.
- **v1 runs the drainer in the API process**, triggered by the cron endpoint, as ADR 0002 decided.
- **The upgrade path is a worker process built from the same codebase**: one image with two entrypoints, `api` and `worker`, scaled independently. The worker calls the same `drainOutbox` entry function on its own loop or schedule. Nothing in `src/lib/outbox` changes.

Two rules keep that path cheap, and they apply now:

1. **The drainer never depends on the HTTP layer.** `src/lib/outbox` doesn't import `src/api` or hono, as the eslint layering rule already enforces. The cron route is a thin trigger with no logic, per ADR 0002.
2. **One drain tick is bounded.** `drainOutbox` claims a bounded batch and finishes well inside the request timeout. A tick cut off mid-batch is still safe (the lease expires, the fence discards the late result, the attempt is already counted), but every cut-off adds up to one `LEASE` of delay. Batch 3 sets the batch size and the per-tick budget.

## When to take the upgrade

Move delivery to the worker entrypoint when any of these holds:

- Drain ticks regularly hit their time budget with due events left over.
- Tenant POST latency shows up in API latency or event-loop lag.
- The hosting choice in ADR 0010 makes request-scoped crons awkward, for example a platform with short request timeouts or no reliable scheduler.

Revisit a broker only for needs this design doesn't cover: thousands of events a second, several internal consumers that each need a replayable cursor, or tenants who want to consume a stream instead of webhooks. Even then, the move is CDC from the outbox into the broker. The outbox write in tx2 stays.

## Consequences

- The delivery state is a table: it can be inspected with SQL, redriven with an `UPDATE`, and covered by the nightly reconcile.
- No new infrastructure, secrets or local emulators. Integration tests stay on one Postgres.
- The API process carries delivery load until a trigger above fires. That's accepted at v1 volume.
- On a scale-to-zero Postgres, a frequent drain cron keeps compute awake. If that matters once hosting is chosen, drain right after tx2 commits and keep the cron as a slower safety net.
