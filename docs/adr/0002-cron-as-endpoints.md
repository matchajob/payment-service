# ADR 0002: Crons are HTTP endpoints, triggered from outside

**Status:** Accepted, 2026-10-14
**Slice:** 0.0

## Context

Five things run on a schedule: renewal, dunning, housekeeping, reconcile, and the outbox drainer. Each one moves money or tells a tenant something, so each must be observable, testable with a controlled clock, and safe when it fires twice. Cloud Run can scale to more than one instance, and it can scale to zero.

Three options:

1. **HTTP endpoints under `/internal/cron/*`, triggered by Cloud Scheduler.** Each cron is a route that calls one entry function such as `runRenewal(now)` and returns a small summary body. Cloud Scheduler calls it on a schedule and retries on non-2xx. The route is guarded by a shared secret.
2. **In-process timers.** `setInterval` inside the service. No external wiring, but a second instance double-fires every job, a scale-to-zero instance never fires, and a test has to fake timers across the whole process.
3. **A separate worker service.** Clean isolation, but a second deployable, a second set of secrets, and nothing in v1 that needs the separation.

The remaining question is where the clock comes from. The workplan seam table says cron entry functions are called with an injected clock. Two shapes for the HTTP layer:

- a. The endpoint accepts `now` as a request parameter in tests only.
- b. The endpoint never reads time from the request. The app is constructed with a `Clock`, and tests construct the app with a fake one.

## Decision

Option 1, with clock shape b.

- Routes live under `/internal/cron/<name>`: `renewal`, `dunning`, `housekeeping`, `reconcile`, `drain-outbox`, `purge-idempotency`.
- Auth is a shared secret presented as `Authorization: Bearer <CRON_SECRET>`. A wrong or missing secret is a `401` problem+json, identical in shape to a tenant auth failure. Cloud Scheduler OIDC tokens would be stronger and are a possible later swap, but they are not testable through `app.request()` without faking Google's token endpoint.
- Each route does exactly one thing: read `now` from the injected clock, call the entry function, return `{ processed, failed }` counts as JSON. No business logic lives in the route.
- The entry functions are the real unit. Everything they need, including the clock, the db handle, and the provider, arrives as a parameter.

## Consequences

- Every cron must be safe to double-fire. Cloud Scheduler retries, and two Scheduler jobs can overlap if one runs long. The row lock and the partial unique index in slice 8, and `FOR UPDATE SKIP LOCKED` in slice 6, are what make this true. The endpoint does not add a global mutex.
- A cron that takes longer than the Cloud Run request timeout is a bug in batch sizing, not a reason to move to a worker. Each entry function processes a bounded batch and returns.
- Shape b means no code path exists where a caller can tell the service what time it is. An endpoint that accepts time is an endpoint that can be told to charge early. The cost is that the HTTP seam tests for crons assert wiring and auth only, and the clock-dependent behaviour is tested by calling the entry functions directly, as the seam table already planned.
- The `Clock` type and its fake are built in slice 0.4. Until then nothing reads time.
- `CRON_SECRET` is an environment variable, listed in `.env.example`, injected from Secret Manager in production.
