# Workplan

Build order for the payment service. Each slice is a tracer bullet: a narrow but complete path through schema, logic, API, and tests that is verifiable on its own. Each declares what blocks it. Work the frontier: any slice whose blockers are all done can start.

Every slice follows the protocol in `CLAUDE.md`: Claude proposes the seam and first tests, Omer writes them red, writes the implementation green, Claude reviews against the spec row, commit.

Spec references point at `spec/subscription-lifecycle.md` rows (S1 r5 means Spec 1 row 5) and `spec/*.md` rule numbers.

## Test seams (agreed before any test is written)

| Seam | What it exercises | What it misses |
|---|---|---|
| Pure functions | State machine transitions, period math, dunning arithmetic, HMAC. No DB, no IO. | Nothing about persistence or concurrency. |
| HTTP via `app.request()` | Routes, auth, problem+json, idempotency middleware, webhook ingestion. Real Postgres underneath. | Real network, real provider. |
| Cron entry functions | `runRenewal(now)`, `runDunning(now)`, `runHousekeeping(now)`, `drainOutbox(now)` called directly with an injected clock. | Scheduler wiring. |
| Fake provider | In-memory `PaymentProvider` that records calls and returns scripted results. | Provider-specific parsing, covered by adapter slices. |
| Fake tenant endpoint | In-memory HTTP sink the drainer POSTs to. Asserts signature, body, retries. | A real receiver, covered by slice 13. |

Integration tests run against a real local Postgres. Each test runs in a transaction that is rolled back, or truncates. Decided in slice 0.4.

---

## Phase 0: Foundations

No business logic. Everything here exists so that slice 1 can be a real vertical slice.

### 0.0 Decisions to record as ADRs

Blocked by: none.

- [x] **Infra access.** Decided 2026-10-13, see `docs/adr/0001-infra-access.md`. `@matcha/infra` as a pinned git dependency on the job-platform repo with a subdirectory path, bumped deliberately. Alternative: tsconfig path to `../job-platform/src/infra`, which works only when both checkouts are siblings and breaks CI. Write `docs/adr/0001-infra-access.md`.
- [x] **Cron mechanism.** Decided 2026-10-14, see `docs/adr/0002-cron-as-endpoints.md`. Clock is a construction parameter of the app, never a request parameter. Recommended: each cron is an HTTP endpoint under `/internal/cron/*` guarded by a shared secret, triggered by Cloud Scheduler. Stateless, testable through the HTTP seam, and the clock is a request parameter in tests. Alternative: in-process timers, which are harder to test and double-fire with two instances. `docs/adr/0002-cron-as-endpoints.md`.
- [x] **Test database strategy.** Decided 2026-10-14, see `docs/adr/0003-test-database.md`. Recommended: one local Postgres via docker compose, migrations applied once per run, each test wrapped in a transaction that rolls back. Alternative: truncate between tests, slower but allows testing commit-dependent behaviour such as `FOR UPDATE SKIP LOCKED`. The outbox slice needs real commits, so the plan uses rollback by default and a truncate mode for that suite. `docs/adr/0003-test-database.md`.
- [x] **Money representation.** Decided 2026-10-14, see `docs/adr/0004-money.md`. Minor units as integers, currency as an enum with only `ILS`. Never floats. `docs/adr/0004-money.md`.

What you learn: how to write an ADR that someone can disagree with later, and why each of these is a one-way door.

### 0.1 Toolchain

Blocked by: 0.0 infra access.

- [x] `package.json` with pnpm, `type: module`, pinned `@matcha/infra` and its server peers. Scripts `lint`, `test`, `test:run`, `dev` still to add.
- [x] `tsconfig.json` with the same strict flags as job-platform: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedSideEffectImports`.
- [ ] `eslint.config.mjs` with the four layer rules from the subrepo: no `@supabase/*`, no relative parent imports, contract purity, lib never imports api or hono.
- [ ] `vitest.config.ts` with unit and integration projects.
- [ ] `.gitignore`, `.env.example`.
- [ ] First commit.

Delivers: `pnpm typecheck && pnpm lint && pnpm test:run` all pass on an empty project.

What you learn: what each strict flag rejects and why `verbatimModuleSyntax` is what keeps server code out of a client bundle.

### 0.2 Database

Blocked by: 0.1, 0.0 test database.

- [ ] `docker-compose.yml` with Postgres.
- [ ] `drizzle.config.ts`, `src/lib/db.ts` using `createDB` from `@matcha/infra/domain-drizzle`.
- [ ] Migration scripts `db:generate`, `db:migrate`.
- [ ] One throwaway table to prove the loop, deleted in slice 1.

Delivers: a migration generated, applied, and queried from a test.

### 0.3 HTTP skeleton

Blocked by: 0.1.

- [ ] Hono app in `src/api`, `GET /health`.
- [ ] Problem+json error shape in `src/contract/problem.ts` and a Hono error handler that produces it.
- [ ] Request logging with pino via `@matcha/infra/pino`.

Delivers: a test that calls `app.request('/health')` and asserts the body, and a test that an unknown route returns problem+json.

What you learn: why errors are a contract, not an afterthought, and how one error handler keeps every route honest.

### 0.4 Test harness

Blocked by: 0.2, 0.3.

- [ ] Integration test setup: connect, migrate, transaction-per-test helper.
- [ ] Injected clock type and a fake clock.
- [ ] `FakePaymentProvider` implementing the `PaymentProvider` port with scripted responses and a call log.
- [ ] `FakeTenantEndpoint` sink.

Delivers: one integration test that writes a row inside the helper and proves it is gone afterwards.

### 0.5 Deploy skeleton

Blocked by: 0.3.

- [ ] Dockerfile, GCP Cloud Run service, secret wiring, `/health` reachable.
- [ ] CI: typecheck, lint, test on push.

Delivers: a URL that returns `/health`. Deploying early means every later slice can be deployed in minutes, and the deployment itself is never the risky step.

---

## Phase 1: Tenancy and the request contract

### 1. Tenant, plan, customer

Blocked by: 0.4.

Spec: tenant billing policy table in Spec 1, D8 plan immutability.

- [ ] `tenants` entity with DZD: slug, API key hash, `webhookUrl`, `webhookSecret`, the four policy knobs with their defaults.
- [ ] `plans` entity: tenant ref, name, `amountMinor`, `currency`, `interval`. No update route exists, ever.
- [ ] `customers` entity: tenant ref, `externalRef`.
- [ ] Tenant authentication middleware: API key header to tenant context. Unknown key is `401` problem+json.
- [ ] `POST /v1/customers`, `GET /v1/customers/:id`, `GET /v1/plans`.
- [ ] `src/contract` zod schemas for each, with `Expect<Equals<>>` drift tests against the DZD read schemas.
- [ ] Seed script that creates a tenant and a plan.

Delivers: a tenant can authenticate and create a customer. Two tenants cannot see each other's rows.

What you learn: DZD end to end on three simple entities before the hard ones. Why the contract layer is a separate directory and what the lint rule protects.

### 2. Idempotency

Blocked by: 1.

Spec: `spec/idempotency.md` rules 1 to 6, D9, D10.

- [ ] `idempotency_keys` entity: tenant ref, key, body hash, state, stored response, timestamps.
- [ ] Middleware applied to every `/v1` mutation, tested first on `POST /v1/customers` because it is the simplest mutation.
- [ ] Tests, one per rule: new key executes once; replay returns stored response byte for byte; body mismatch is `422`; in-flight is `409` with `Retry-After: 1`; a reservation older than 90s is taken over; stored errors replay as the same error; failed auth reserves nothing.
- [ ] `runIdempotencyPurge(now)` cron deleting completed keys older than 24h.

Delivers: a retried `POST /v1/customers` creates one customer.

What you learn: why reservation and handler mutations must share a transaction, and why hold-and-wait was rejected in D9.

---

## Phase 2: The lifecycle core

### 3. Pure state machine

Blocked by: 0.1 only. Can run in parallel with 1 and 2.

Spec: Spec 1 transition table, both schedule owners.

- [ ] `src/lib/subscriptions/state-machine.ts`: a table of `(state, flag, event, scheduleOwner) → outcome` where outcome is a new state plus effects, or a rejection with a reason.
- [ ] Exhaustive unit tests: every row in the spec table, every absent pair rejected, `canceled` rejects everything. A type-level test that the table covers every state and event.
- [ ] Decide and record the `past_due` + flag behaviour (PRD open question 4) as an ADR before writing those rows.

Delivers: the heart of the service as a pure module with no IO, understood line by line.

What you learn: why a table beats nested `if`s for a state machine, and how exhaustiveness checking turns a forgotten transition into a compile error.

### 4. Create subscription

Blocked by: 2, 3.

Spec: S1 r1.

- [ ] `subscriptions` entity: customer ref, plan ref, status, `scheduleOwner`, `currentPeriodEnd`, `anchorDay`, `cancelAtPeriodEnd`, `canceledAt`, dunning attempt counter, sequence counter.
- [ ] `PaymentProvider` port in `src/lib/payments/provider.ts`, written fresh from the capabilities interface in the PRD.
- [ ] `POST /v1/subscriptions`: creates `incomplete`, calls `startCheckout` on the fake provider, returns `checkoutUrl`.
- [ ] The provider call runs outside the idempotency reservation transaction (Spec 3 note). Test that a provider failure leaves no subscription row and no reserved key in a bad state.

Delivers: a tenant starts a checkout and gets a URL.

### 5. Checkout completed, inbound webhooks, outbox write

Blocked by: 4.

Spec: S1 r2, Spec 4 rules 1 to 7, Spec 5 rules 1 and 3.

- [ ] `webhook_events` entity: provider, tenant, dedup key, raw payload, trust flag, processed at.
- [ ] `POST /v1/webhooks/:provider/:tenantSlug`: persist first, dedup, then interpret.
- [ ] Unsigned path: `parseWebhook` yields untrusted, the handler calls `verifyCharge`, only then transitions.
- [ ] `payment_methods` and `charges` entities. Charge #1 recorded with dedup key `subscriptionId:periodEnd:0`, amount from the plan row, never from the payload.
- [ ] Period 1 computed: `currentPeriodEnd`, `anchorDay` stored.
- [ ] `outbox_events` entity. `subscription.activated` written in the same transaction with the full snapshot and sequence 1. Not delivered yet.
- [ ] Tests: replayed webhook processes once; payload claiming a different amount is ignored; bad signature is rejected and logged; garbage returns `200`; internal failure returns `5xx`; a webhook for a `canceled` subscription is a logged no-op.

Delivers: a fake checkout completion activates the subscription and leaves one outbox row.

What you learn: persist-first as a reliability pattern, and why the outbox row and the state change are one transaction.

### 6. Outbox drainer

Blocked by: 5.

Spec: `spec/outbox-delivery.md` rules 2, 5, 6, 7, D12, D13.

- [ ] `drainOutbox(now)`: claim with `FOR UPDATE SKIP LOCKED`, POST to the tenant's `webhookUrl`, mark delivered on 2xx, exponential backoff otherwise.
- [ ] HMAC-SHA256 over `timestamp.body` as a pure function with a known-answer test. Headers `Payments-Signature` and `Payments-Timestamp`.
- [ ] Dead letter at 8 attempts with the last error retained.
- [ ] Manual redrive script.
- [ ] Tests using the fake tenant endpoint and the truncate-mode database: two concurrent drainers never deliver the same event twice; a 500 then a 200 delivers once with backoff; the ninth attempt never happens.

Delivers: the tenant receives a signed, fat `subscription.activated` event.

What you learn: why `SKIP LOCKED` is the whole concurrency story for a queue in Postgres.

---

## Phase 3: Money moves on a schedule

### 7. Period math

Blocked by: 0.1 only. Can run early.

Spec: `spec/charging-and-dunning.md` period anchoring and advancement.

- [ ] Pure `nextPeriodEnd(previousEnd, anchorDay, interval)` with month-end clamp and a persistent anchor.
- [ ] Tests: Jan 31 → Feb 28 → Mar 31; Feb 29 leap year; monthly and yearly intervals; UTC only.

Delivers: the one function the predecessor got wrong, correct and proven before any cron exists.

### 8. Renewal cron

Blocked by: 6, 7.

Spec: S1 r5, r6, r7, Spec 2 due detection, Spec 1 double-charge guards.

- [ ] `runRenewal(now)` through the cron endpoint: select due rows, lock each, re-verify status and unpaid period, charge via the port with dedup key `subscriptionId:periodEnd:0`.
- [ ] Success: advance from `oldPeriodEnd`, write `charge.succeeded`. Failure: `past_due`, write `charge.failed` and `subscription.past_due`, start the dunning clock. Flagged: `canceled` with no charge, write `subscription.canceled`.
- [ ] Partial unique index: one succeeded charge per (subscription, `periodEnd`).
- [ ] Tests: nothing charges before `currentPeriodEnd`; a row stays `active` during cron lag; two concurrent crons charge once; the unique index fires if the lock is bypassed in a test.

Delivers: a subscription renews on its anniversary and the tenant hears about it.

### 9. Cancel and resume

Blocked by: 5.

Spec: S1 r4, r8, r9, r12, r15, D2, D6.

- [ ] `POST /v1/subscriptions/:id/cancel`: no parameters. State decides: `incomplete` and `past_due` cancel now, `active` sets the flag.
- [ ] `POST /v1/subscriptions/:id/resume`: clears the flag when `resumeAllowed`, else `409`.
- [ ] Every mutation on `canceled` is `409`.
- [ ] Computed `entitled` added to the subscription resource and to every outbox snapshot.

Delivers: the full cancel story end to end, including the tenant-visible flag and effective date.

### 10. Dunning

Blocked by: 8.

Spec: S1 r10, r11, Spec 2 retry arithmetic and recovery period, D3, D4, D7.

- [ ] Pure `nextRetryAt(failedAt, attempt, dunningSchedule)`.
- [ ] `runDunning(now)`: due retries, same lock and guards as renewal, dedup key attempt 1..N.
- [ ] Success: new period from the original `periodEnd`, dunning reset. Final failure: `canceled` with `reason: payment_failure`.
- [ ] `entitled` honours `graceEntitlement` while `past_due`.
- [ ] Tests: the +1d/+3d/+7d default fires on the right days; a rescue on day 5 still ends the new period one interval after the old end; a tenant with `graceEntitlement: false` is not entitled while `past_due`.

Delivers: a failed card gets a week of retries and the customer keeps access while it happens.

### 11. Update payment method

Blocked by: 10.

Spec: S1 r13, r14, D5.

- [ ] `POST /v1/subscriptions/:id/update-payment-method`: capture-mode checkout, no charge.
- [ ] Completion webhook replaces the token. From `past_due`, an immediate retry runs and supersedes the pending scheduled retry.
- [ ] Tests: a capture never produces a charge row; the immediate retry and the scheduled retry cannot both fire.

Delivers: the rescue path a real customer uses when their card expired.

### 12. Housekeeping and reconcile

Blocked by: 8.

Spec: S1 r3, Spec 4 rule 8.

- [ ] `runHousekeeping(now)`: `incomplete` rows older than the tenant's `checkoutTtlHours` become `canceled` silently.
- [ ] `runReconcile(now)`: nightly `verifyCharge` for every unsettled charge; a lost webhook is repaired here.
- [ ] Tests: a 12h-old checkout is canceled, an 11h one is not; a charge the provider says succeeded but we never heard about is settled.

Delivers: the two safety nets that make the system self-healing.

---

## Phase 4: Real providers

### 13. Grow adapter

Blocked by: 5. Can start once the port is exercised.

- [ ] `src/infra/grow/` wrapper taking injected config, no domain imports.
- [ ] `src/lib/payments/grow.ts` re-wrap implementing `PaymentProvider` with `signedWebhooks: false`.
- [ ] Contract tests against recorded Grow responses. A sandbox run gated behind an env flag.

Delivers: a real card checkout in Grow's sandbox activates a subscription.

### 14. RevenueCat adapter and external mode

Blocked by: 10, 13 for the layering pattern.

Spec: Spec 1 external mode section, D11.

- [ ] Adapter with `signedWebhooks: true`, `providerManagedSchedule: true`.
- [ ] Store notifications normalised to lifecycle events. Grace maps to `past_due`, expiry to `canceled`. Charges recorded with `source: external`, dedup on store transaction id.
- [ ] API cancel, resume, update-payment-method return `409` for external subscriptions.
- [ ] Tests: a signed notification transitions without a verify call; a tampered signature does nothing; our cron never touches an external row.

Delivers: an App Store subscription mirrored into the same four states.

---

## Phase 5: The tenant side

### 15. Receiver in job-platform

Blocked by: 6, 9.

Spec: `spec/outbox-delivery.md` receiver contract. Resolves PRD open question 5, the PRODUCT:HIGH downgrade.

- [ ] Endpoint in job-platform: verify HMAC, reject timestamps older than 5 minutes, respond 2xx first, dedup by event id, upsert a `subscription_status` mirror by sequence.
- [ ] Product decision: what an employer loses when `entitled` becomes false, and when. Recorded as an ADR in job-platform.
- [ ] Import the zod contract from this repo. One type on both sides of the wire.

Delivers: the first real tenant reacts to a real event.

### 16. Production deploy

Blocked by: 12, 13, 15.

- [ ] Cloud Scheduler jobs for the four crons and the drainer.
- [ ] Secrets, tenant onboarding runbook, redrive runbook.
- [ ] Smoke test in production with a real Grow sandbox tenant.

---

## Frontier at start

Slices with no unfinished blockers right now: **0.0**. After 0.0, slices **0.1**, **3**, and **7** open up, and 3 and 7 are pure modules you can write while the toolchain settles.

## Deliberately not in the plan

Plan changes, trials, proration, multi-currency, hard-decline short-circuiting, refunds, alerting on dead letters. All listed as out of scope in `PRD.md`. The `refunds` capability flag exists in the port but no slice implements a refund.
