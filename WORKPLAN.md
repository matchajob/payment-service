# Workplan

Build order for the payment service. Each slice is a tracer bullet: a narrow but complete path through schema, logic, API, and tests that is verifiable on its own. Each declares what blocks it. Work the frontier: any slice whose blockers are all done can start.

Every slice follows the protocol in `CLAUDE.md`: Claude proposes the seam and first tests, Omer writes them red, writes the implementation green, Claude reviews against the spec row, commit.

Spec references point at `spec/subscription-lifecycle.md` rows (S1 r5 means Spec 1 row 5) and `spec/*.md` rule numbers.

## Test seams (agreed before any test is written)

| Seam                     | What it exercises                                                                                                        | What it misses                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Pure functions           | State machine transitions, period math, dunning arithmetic, HMAC. No DB, no IO.                                          | Nothing about persistence or concurrency.             |
| HTTP via `app.request()` | Routes, auth, problem+json, idempotency middleware, webhook ingestion. Real Postgres underneath.                         | Real network, real provider.                          |
| Cron entry functions     | `runRenewal(now)`, `runDunning(now)`, `runHousekeeping(now)`, `drainOutbox(now)` called directly with an injected clock. | Scheduler wiring.                                     |
| Fake provider            | In-memory `PaymentProvider` that records calls and returns scripted results.                                             | Provider-specific parsing, covered by adapter slices. |
| Fake tenant endpoint     | In-memory HTTP sink the drainer POSTs to. Asserts signature, body, retries.                                              | A real receiver, covered by slice 13.                 |

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

- [x] `package.json` with pnpm, `type: module`, pinned `@matcha/infra` and its server peers, scripts `lint`, `test`, `test:run`, `dev`.
- [x] `tsconfig.json` with the same strict flags as job-platform: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedSideEffectImports`.
- [x] `eslint.config.mjs` with the four layer rules from the subrepo: no `@supabase/*`, no relative parent imports, contract purity, lib never imports api or hono. Plus a fifth: `src/infra` never imports `@/*`.
- [x] `vitest.config.ts` with unit and integration projects.
- [x] `.gitignore`, `.env.example`.
- [x] First commit.

Delivers: `pnpm typecheck && pnpm lint && pnpm test:run` all pass on an empty project.

What you learn: what each strict flag rejects and why `verbatimModuleSyntax` is what keeps server code out of a client bundle.

### 0.2 Database

Blocked by: 0.1, 0.0 test database.

- [x] `docker-compose.yml` with Postgres.
- [x] `drizzle.config.ts`, `src/lib/db.ts` with `createDb(url)` built on `resolveDbProvider` from `@matcha/infra/postgres/resolve` (infra has no `createDB`; the app owns the drizzle instance).
- [x] Migration scripts `db:generate`, `db:migrate`. Decided 2026-10-14: `drizzle/` is gitignored during local development, so CI must run `db:generate` before tests. Revisit before slice 16: production needs reviewed, incremental migrations.
- [x] One throwaway table to prove the loop, deleted in slice 1. `loop_probe` in `src/lib/loop-probe/schema.ts`.

Delivers: a migration generated, applied, and queried from a test.

### 0.3 HTTP skeleton

Blocked by: 0.1.

- [x] Hono app in `src/api`, `GET /health`.
- [x] Problem+json error shape in `src/contract/problem.ts` and a Hono error handler that produces it.
- [x] Request logging with `pino` directly, logger injected into `createApp`. `@matcha/infra/pino` is only an SLO sink, not a request logger.

Delivers: a test that calls `app.request('/health')` and asserts the body, and a test that an unknown route returns problem+json.

What you learn: why errors are a contract, not an afterthought, and how one error handler keeps every route honest.

### 0.4 Test harness

Blocked by: 0.2, 0.3.

- [x] Integration test setup: connect, migrate (vitest globalSetup, once per run), transaction-per-test helper.
- [x] Injected clock type and a fake clock.
- [x] `FakePaymentProvider` implementing the `PaymentProvider` port with scripted responses and a call log.

Delivers: one integration test that writes a row inside the helper and proves it is gone afterwards.

### 0.5 Deploy skeleton

Blocked by: 0.3, 0.6.

- [ ] Dockerfile, `/health` reachable on the Cloud Run service that 0.6 declares.
- [ ] CI: typecheck, lint, test on push.

Delivers: a URL that returns `/health`. Deploying early means every later slice can be deployed in minutes, and the deployment itself is never the risky step.

### 0.6 Infrastructure as code (Pulumi)

Blocked by: 0.1.

- [x] ADR: Pulumi in TypeScript, the state backend (Pulumi Cloud or a GCS bucket), one stack per environment (`staging`, `production`), and where the program lives. Not under `src/infra`, which is the portable code layer and means something else here. ADR 0012.
- [x] Declared resources: Artifact Registry, the Cloud Run service and its service account, the Postgres instance, Secret Manager entries (values set out of band, never in the stack config), and the Cloud Scheduler jobs for the crons and the drainer as they appear.
- [x] CI runs the iac unit tests, then `pulumi preview` on every push and `pulumi up` on `staging` from `main`. `production` is previewed from `main` only and applied by hand.
- [x] Unit tests of the program with Pulumi's mocks: every secret is a Secret Manager reference, the scheduler jobs are OIDC-signed by `cron-invoker` with no `Authorization` header (ADR 0012 amends ADR 0002), and only `main` can become the production deployer. Cloud Run is publicly invocable by design, so "the cron endpoints are not public" is the app's job and `cron-auth.test.ts` covers it.
- [ ] Review fixes (2026-10-16): production deployer trust pinned to `main`, iac tests gate the apply, `attemptDeadline` matches the service timeout, Resource Manager API enabled.

Delivers: `pulumi up` on an empty GCP project produces everything 0.5 deploys into. Nothing is clicked in the console, so staging and production cannot drift apart.

What you learn: why infrastructure is reviewed like code, and why secret values stay out of state even when the state backend is encrypted.

---

## Phase 1: Tenancy and the request contract

### 1. Tenant, plan, customer

Blocked by: 0.4.

Spec: tenant billing policy table in Spec 1, D8 plan immutability.

- [x] `tenants` entity with DZD: slug, API key hash, `webhookUrl`, `webhookSecret`, the four policy knobs. Defaults live in `TENANT_POLICY_DEFAULTS`, applied by `createTenant`, not as column defaults.
- [x] `plans` entity: tenant ref, name, `amountMinor`, `currency`, `interval`. No update route exists, ever. The currency enum carries `USD` too; see the ADR 0004 amendment.
- [x] `customers` entity: tenant ref, `externalRef`, unique per tenant.
- [x] Tenant authentication middleware: API key header to tenant context. Unknown key is `401` problem+json.
- [x] `POST /v1/customers`, `GET /v1/customers/:id`, `GET /v1/plans`.
- [x] `src/contract` zod schemas for each, with drift tests against the DZD schemas. The drift tests are behavioural (boundary inputs and enum parity), not `Expect<Equals<>>`: DZD types carry brands, so the types never compare equal even when they agree. Every route response is also checked against its contract with no extra fields.
- [x] Seed script `pnpm db:seed` that creates a tenant and a plan from CLI flags. The code never names a real tenant.

Decided 2026-10-14:

- Four commits: 1.1 tenants and auth middleware, 1.2 plans and `GET /v1/plans`, 1.3 customers, routes and isolation, 1.4 contract drift tests, seed, and deleting `loop_probe`.
- The API key travels as `Authorization: Bearer <key>`, stored as a SHA-256 hash and looked up by it. Keys are 32 random bytes, so a slow hash adds nothing, and a salted one cannot be found with a `WHERE`.
- A duplicate `externalRef` for the same tenant is `409` problem+json, backed by a unique `(tenant_id, external_ref)`. Retries are slice 2's job.
- A cross-tenant read is `404`, never `403`, so ids do not leak existence.
- "One plan per tenant" (PRD 1.3) means one sellable plan, not a unique constraint. A price change is a new row (D8), and old rows stay for their subscribers.

Delivers: a tenant can authenticate and create a customer. Two tenants cannot see each other's rows.

What you learn: DZD end to end on three simple entities before the hard ones. Why the contract layer is a separate directory and what the lint rule protects.

### 2. Idempotency

Blocked by: 1.

Spec: `spec/idempotency.md` rules 1 to 6, D9, D10.

- [x] `idempotency_keys` entity: tenant ref, key, body hash, stored response, timestamps. There is no `state` column: `completedAt` set means completed. A check constraint makes the four completion columns all set or all null, and a reservation writes `responseBody: null` explicitly because the DZD emptyable string defaults to `''`.
- [x] Middleware applied to every `/v1` mutation (`src/api/idempotency.ts`), after `tenantAuth`. Phase 1 is `reserveKey`, phase 2 is the handler plus `completeKey` in one transaction, and `releaseKey` runs when the handler throws. Routes read `db` from the request context, and the clock is an `AppDeps` parameter.
- [x] Tests, one per rule: new key executes once; replay returns stored response byte for byte; body mismatch is `422`; in-flight is `409` with `Retry-After: 1`; a reservation older than 90s is taken over; stored errors replay as the same error; failed auth reserves nothing. Plus: missing or non-UUID key is `400`, reads need no key, and a handler that writes then throws leaves nothing and frees its key.
- [x] `runIdempotencyPurge(db, now)` deleting completed keys older than 24h, served at `POST /internal/cron/purge-idempotency` behind `CRON_SECRET` (constant-time compare). Reservations are never purged, because `completedAt < cutoff` is false for null.

Decided 2026-10-14, `docs/adr/0006-two-phase-idempotency.md`: two phases (a committed reservation, then the handler and the completion in one transaction), a thrown handler releases its key, responses below 500 are stored, and the key is required (`400` when missing or not a UUID). Handlers read `db` from the request context.

Delivers: a retried `POST /v1/customers` creates one customer.

What you learn: why reservation and handler mutations must share a transaction, and why hold-and-wait was rejected in D9.

### 19. Organizations and provider connections

Blocked by: 5. ADR 0010 accepted 2026-10-16. Lands before 8, so renewal is written against the provider factory once.

Spec: `docs/adr/0010-organizations-and-provider-connections.md` (accepted 2026-10-16, with amendments). Context in `docs/product/hosted-service-strategy.md`.

- [x] `organizations` and `provider_connections` entities. Credentials are an encrypted column (envelope, KMS key per environment) and never appear in a read schema, a log or a problem response.
- [x] `tenants` gains `organizationId` and `providerConnectionId`, with a composite foreign key so an application can only use a connection of its own organization.
- [x] `subscriptions`, `payment_methods` and `charges` carry the `providerConnectionId` pinned when the subscription is created.
- [x] `createApp` takes `providerFor(connection)` instead of one `provider`. `assertProviderSupported` runs when a connection is created, not at boot.
- [x] Inbound webhook route becomes `/v1/webhooks/:provider/:providerConnectionId`. The tenant is found from the checkout reference, and dedup is scoped per connection.
- [x] Seed CLI creates an organization, a connection and an application, in one transaction.
- [x] `localCredentialCipher` (AES-256-GCM, 16-byte tag enforced) for development. `selectCredentialCipher` never falls back to it where a KMS key is configured (ADR 0010 amendment 8).
- [x] Tests: a connection from another organization is rejected by the database; a token is never charged through a connection other than the one that captured it; a subscription keeps its connection after the tenant switches; a webhook to an unknown connection is `404`.

Delivers: two applications of one organization charge through one merchant account, and two organizations never share one.

### 20. KMS credential cipher

Blocked by: 0.6, 19.

Spec: ADR 0010 amendments 4 and 8.

- [ ] Envelope `CredentialCipher` on the `provider-credentials` key: a fresh data key per seal, wrapped by Cloud KMS, with the format version in the sealed string.
- [ ] Old rows still open after the key rotates (90 days). KMS keeps old versions for decrypt; test that the sealed string doesn't pin a version.
- [ ] Decide whether `seal` binds the sealed blob to its `providerConnectionId` as associated data. Without it, someone who can write to the database can copy one organization's sealed credentials onto another organization's connection row, and charges go through the wrong merchant account.
- [ ] `selectCredentialCipher` returns it where `PROVIDER_CREDENTIALS_KMS_KEY` is set.

Delivers: credentials stored in production are sealed under a key that never leaves KMS.

---

## Phase 2: The lifecycle core

### 3. Pure state machine

Blocked by: 0.1 only. Can run in parallel with 1 and 2.

Spec: Spec 1 transition table, both schedule owners.

- [x] `src/lib/subscriptions/state-machine/`, one concept per file: a table of `(state, flag, event) → row`, gated per row by `selfOnly` (scheduleOwner) and `requiresResumeAllowed` (tenant policy); outcome is a new state plus effects and emits, or a rejection with a reason code. Guard order: absent pair, then store-managed, then tenant policy.
- [x] Exhaustive unit tests: every row in the spec table, every absent pair rejected, `canceled` rejects everything. A type-level test that the table covers every state and event.
- [x] Decided 2026-10-14: the dunning cron goes through the machine via `retry_due`, symmetric with `renewal_due`. Row 12 carries an explicit `stop_dunning` effect. `selfOnly` covers spec rows 8, 9, 12, 13 plus the rows where we initiate a charge (`renewal_due`, `retry_due`) and row 14, since the service never initiates charges for store-billed subscriptions.
- [x] Decided 2026-10-14, `docs/adr/0005-past-due-with-cancel-flag.md`: the pair is unreachable. No rows for it, a check constraint in slice 4, and the exhaustiveness test treats it as an absent pair.

Delivers: the heart of the service as a pure module with no IO, understood line by line.

What you learn: why a table beats nested `if`s for a state machine, and how exhaustiveness checking turns a forgotten transition into a compile error.

### 4. Create subscription

Blocked by: 2, 3.

Spec: S1 r1.

- [x] `subscriptions` entity: customer ref, plan ref, status, `scheduleOwner`, `currentPeriodEnd`, `anchorDay`, `cancelAtPeriodEnd`, `canceledAt`, dunning attempt counter, sequence counter. Three check constraints (cancel flag only on `active`, ADR 0005; `incomplete` has no period; `active` and `past_due` have one), with enum values inlined through `sqlLiteral` because DDL takes no parameters.
- [x] `PaymentProvider` port in `src/lib/payments/provider.ts`, written fresh from the capabilities interface in the PRD.
- [x] `POST /v1/subscriptions`: creates `incomplete`, calls `startCheckout` on the fake provider, returns `checkoutUrl`. Amount and currency come from the plan row; `returnUrl` must be http(s).
- [x] The provider call runs outside the reservation transaction (Spec 3 note): phase 1 has committed, and the call runs in phase 2 before any write. Tested: a provider failure leaves no subscription row and no reserved key, and a replay does not call the provider twice.
- [ ] ADR 0007: `saveCardWithoutCharge` capability, checkout in `CAPTURE` mode, and the boot guard in `createApp`.

Decided 2026-10-15:

- The checkout saves the card and charges nothing (`CHECKOUT_MODE.CAPTURE`). Charge #1 runs after activation, in slice 5 (ADR 0007).
- `ProviderCapabilities` gains `saveCardWithoutCharge`. `createApp` refuses to start with a self-managed provider that lacks it. v1 supports only providers that have it; the fallback for the rest is deferred (ADR 0007, PRD open question 6).
- `startCheckout` runs inside phase 2, before any write (ADR 0006 amendment). The subscription id is generated first and sent as the checkout `reference`, so slice 5's webhook maps straight back to the row.
- At most one `active` or `past_due` subscription per customer, enforced by a partial unique index. Several `incomplete` rows are allowed so an abandoned checkout never blocks a retry.
- The provider port gains `currency` and renames `customerRef` to `reference`.
- Until slice 13, `server.ts` wires an unconfigured provider that throws, so `POST /v1/subscriptions` is `500` outside tests.
- A customer or plan from another tenant is `404`.

Delivers: a tenant starts a checkout and gets a URL.

### 5. Checkout completed, inbound webhooks, outbox write

Blocked by: 4.

Spec: S1 r2, Spec 4 rules 1 to 7, Spec 5 rules 1 and 3.

- [x] `webhook_events` entity: provider, tenant, dedup key (SHA-256 of the raw body), raw payload as text, trust flag, received and processed at.
- [x] `POST /v1/webhooks/:provider/:tenantSlug`: persist first, dedup, then interpret. Mounted before the `/v1` auth and idempotency middleware. A replay of a processed event is a no-op; a replay of an event whose interpretation crashed runs again.
- [x] `payment_methods`, `charges` and `outbox_events` entities. Charges: the one-per-attempt unique constraint, the one-live-per-period partial index (`pending` or `succeeded`, ADR 0008), and outcome checks. Outbox: the contract snapshot as the jsonb validator, sequence starting at 1.
- [x] Unsigned path: `parseWebhook` yields untrusted, the handler calls `verifyCheckout` for the saved card, only then transitions.
- [x] Charge #1 via the intent row (ADR 0008): tx1 stores the payment method, activates with period 1 (the one-live index decides here) and inserts a `pending` charge; then `provider.charge` with dedup key `subscriptionId:periodEnd:0`, amount from the plan row; tx2 settles the charge, transitions and writes the outbox event. A timeout stays `pending`.
- [x] Succeeded: `subscription.activated` with the full snapshot and sequence 1. Declined: `canceled`, `charge.failed` (decided 2026-10-16). Lost to the one-live index: `canceled` with no charge, `subscription.canceled`.
- [x] Transition table: `checkout_completed` no longer emits on its own; add `first_charge_succeeded`, `first_charge_failed`, `already_subscribed`.
- [x] Tests: replayed webhook processes once; payload claiming a different amount is ignored; a webhook for a `canceled` subscription is a logged no-op; the three charge #1 outcomes; two paid checkouts for one customer charge once.
- [x] Fix `advancePeriod` reading the year in local time (`getFullYear`), found during slice 5.

Deferred from slice 5:

- A tenant cancel landing between tx1 and tx2 leaves `active_flagged`, so `first_charge_succeeded` is rejected: the charge is recorded but no event goes out. Resolve with cancel in slice 9.
- The `ChargeResult` port type uses `'succeeded'`/`'failed'` literals that only match `CHARGE_STATUS` by coincidence. Type them from the const in slice 13, together with the Grow adapter.
- A crash in tx2 leaves charge #1 `pending` with no event. Reconcile (slice 12) settles it, which needs a lookup by our dedup key: a port change and probably a provider capability with a fallback (ADR 0008).

Delivers: a fake checkout completion activates the subscription and leaves one outbox row.

What you learn: persist-first as a reliability pattern, and why the outbox row and the state change are one transaction.

### 6. Outbox drainer

Blocked by: 5.

Spec: `spec/outbox-delivery.md` rules 2, 5, 6, 7, D12, D13.

- [x] `drainOutbox(now)`: claim with `FOR UPDATE SKIP LOCKED`, POST to the tenant's `webhookUrl`, mark delivered on 2xx, exponential backoff otherwise.
- [x] HMAC-SHA256 over `timestamp.body` as a pure function with a known-answer test. Headers `Payments-Signature` and `Payments-Timestamp`.
- [x] `FakeTenantEndpoint` in `tests/utils/`: records each delivery (headers and body), answers with scripted statuses. Moved here from 0.4.
- [x] Dead letter at 8 attempts with the last error retained.
- [x] Manual redrive script.
- [x] Tests using the fake tenant endpoint and the truncate-mode database: two concurrent drainers never deliver the same event twice; a 500 then a 200 delivers once with backoff; the ninth attempt never happens.

Delivers: the tenant receives a signed, fat `subscription.activated` event.

What you learn: why `SKIP LOCKED` is the whole concurrency story for a queue in Postgres.

---

## Phase 3: Money moves on a schedule

### 7. Period math

Blocked by: 0.1 only. Can run early.

Spec: `spec/charging-and-dunning.md` period anchoring and advancement.

- [x] Pure `advancePeriod(previousEnd, anchorDay, interval)` with month-end clamp and a persistent anchor, plus `startPeriod(activatedAt, interval)` returning the anchor so activation cannot forget to store it.
- [x] Tests: Jan 31 → Feb 28 → Mar 31; Feb 29 leap year; monthly and yearly intervals; UTC only; time of day preserved.

Delivers: the one function the predecessor got wrong, correct and proven before any cron exists.

### 8. Renewal cron

Blocked by: 6, 7, 19.

Spec: S1 r5, r6, r7, Spec 2 due detection, Spec 1 double-charge guards.

- [x] `runRenewal(now)` through the cron endpoint: select due rows, lock each, re-verify status and unpaid period, charge via the port with dedup key `subscriptionId:periodEnd:0`.
- [x] Success: advance from `oldPeriodEnd`, write `charge.succeeded`. Failure: `past_due`, write `charge.failed` and `subscription.past_due`, start the dunning clock. Flagged: `canceled` with no charge, write `subscription.canceled`.
- [x] Partial unique index: one succeeded charge per (subscription, `periodEnd`). Done early in slice 5 as `charges_one_live_per_period`, which counts `pending` too (ADR 0008).
- [x] Tests: nothing charges before `currentPeriodEnd`; a row stays `active` during cron lag; two concurrent crons charge once; the unique index fires if the lock is bypassed in a test.

Decided 2026-10-16, `docs/adr/0013-renewal-runs-hourly-in-batches.md`: hourly, at most 100 per run, `FOR UPDATE SKIP LOCKED` in tx1, and the due query skips periods that already have a live charge. Settlement shares `recordChargeResult` with charge #1.

Delivers: a subscription renews on its anniversary and the tenant hears about it.

### 9. Cancel and resume

Blocked by: 5.

Spec: S1 r4, r8, r9, r12, r15, D2, D6.

- [x] `POST /v1/subscriptions/:id/cancel`: no parameters. State decides: `incomplete` and `past_due` cancel now, `active` sets the flag.
- [x] `POST /v1/subscriptions/:id/resume`: clears the flag when `resumeAllowed`, else `409`.
- [x] Every mutation on `canceled` is `409`.
- [x] Computed `entitled` added to the subscription resource and to every outbox snapshot.

Decided 2026-10-16, `docs/adr/0016-cancel-resume-and-the-subscription-resource.md`: the resource is the event snapshot (with `canceledAt`, plus `GET /v1/subscriptions/:id`), resume on an unflagged active subscription is a `200` no-op, and cancel is `409` with `Retry-After` while a charge is pending. `entitled` in every snapshot shipped in slice 5.

Delivers: the full cancel story end to end, including the tenant-visible flag and effective date.

### 10. Dunning

Blocked by: 8.

Spec: S1 r10, r11, Spec 2 retry arithmetic and recovery period, D3, D4, D7.

- [x] Pure `nextRetryAt(failedAt, attempt, dunningSchedule)`.
- [x] `runDunning(now)`: due retries, same lock and guards as renewal, dedup key attempt 1..N.
- [x] Success: new period from the original `periodEnd`, dunning reset. Final failure: `canceled` with `reason: payment_failure`.
- [x] `entitled` honours `graceEntitlement` while `past_due`.
- [x] Tests: the +1d/+3d/+7d default fires on the right days; a rescue on day 5 still ends the new period one interval after the old end; a tenant with `graceEntitlement: false` is not entitled while `past_due`.

Decided 2026-10-16, `docs/adr/0014-dunning-schedule-events-and-cancel-reason.md`: stored `nextRetryAt` and `dunningStartedAt`, one charge engine shared with renewal, `charge.failed` on every failed retry, and `cancelReason` in the schema and the published snapshot. The `entitled` item was already covered by `isEntitled` and `to-snapshot.test.ts` (slice 5).

Delivers: a failed card gets a week of retries and the customer keeps access while it happens.

### 11. Update payment method

Blocked by: 10.

Spec: S1 r13, r14, D5. ADR 0018.

- [x] `POST /v1/subscriptions/:id/update-payment-method` with `{ returnUrl }`: capture-mode checkout on the pinned connection, no charge. `409` for `incomplete`, `canceled` and store-billed.
- [x] `payment_method_updates` entity: one row per request, session unique per connection (ADR 0018 decision 1).
- [x] Completion webhook replaces the token. From `past_due`, an immediate retry runs and supersedes the pending scheduled retry.
- [x] `subscriptions.dunningAttemptBase`: a failed immediate retry restarts the full schedule (ADR 0018 decision 2).
- [x] Tests: a capture never produces a charge row; the immediate retry and the scheduled retry cannot both fire; an older link still works; a replay replaces once; the restarted schedule runs +1d/+3d/+7d from the update.

Delivers: the rescue path a real customer uses when their card expired.

### 12. Housekeeping and reconcile

Blocked by: 8.

Spec: S1 r3, Spec 4 rule 8.

- [x] `runHousekeeping(now)`: `incomplete` rows older than the tenant's `checkoutTtlHours` become `canceled` silently.
- [x] Port (ADR 0017): `verifyCharge({ dedupKey, providerChargeRef })`, capability `lookupByReference`, `VerifiedCharge` gains `not_found` and the amount on success.
- [x] `runReconcile(now)`: hourly, not nightly (ADR 0017). Settles each pending charge through its own cycle. `not_found` past 24h is a decline (decision X). Flags what it can't settle (`stuck_pending`, `ref_not_found`, `no_reference_lookup`, `amount_mismatch`) and re-checks not-found failures for 7 days (`late_success`).
- [x] `recordChargeResult` settles only a `pending` row, so a live settle and reconcile can't both apply.
- [x] CLI to settle a flagged charge by hand, through the same cycle: `pnpm charges:settle --charge <id> --succeeded <ref> | --failed <reason>`. Pending or flagged only; a `late_success` is refused, its refund happens outside the system.
- [x] Tests: a 12h-old checkout is canceled, an 11h one is not; a charge the provider says succeeded but we never heard about is settled; every row of the ADR 0017 outcome table; two concurrent reconciles settle once.

Delivers: the two safety nets that make the system self-healing.

---

## Phase 4: Real providers

### 13. Grow adapter

Blocked by: 5. Can start once the port is exercised.

- [x] `src/infra/grow/` wrapper taking injected config, no domain imports.
- [x] `src/lib/payments/grow/` re-wrap implementing `PaymentProvider` with `signedWebhooks: false`.
- [x] Contract tests against recorded Grow responses.
- [ ] A sandbox run gated behind an env flag.
- [ ] Confirm in the sandbox that Grow's token-only checkout saves a card with no charge, and that a token charge right after it succeeds without a 3DS step (ADR 0007). If either fails, the deferred fallback becomes v1 work.
- [x] Decisions (ADR 0019, 2026-10-17): `charges.chargeSerial` as Grow's `transactionUniqueIdentifier`; opaque, adapter-owned refs; the payer's name and phone read from Grow's page; credentials `{ userId, pageCode }`, with `apiKey` as app config.
- [x] Tests written (2026-10-17): `tests/unit/grow/grow-client.test.ts`, `tests/unit/payments/grow/*.test.ts`, `tests/integration/charges/charge-serial.test.ts`, and the existing call assertions now carry the serial.
- [x] `charges.chargeSerial` identity column (`bigint`); `ChargeRequest` and `VerifyChargeRequest` carry it, and `VerifyChargeRequest` also carries `paymentMethodToken`.
- [x] `buildProviderFrom` builds the Grow adapter from app config (`GROW_BASE_URL`, optional `GROW_API_KEY`, 10s timeout, `PUBLIC_BASE_URL` for `notifyUrl`).
- [ ] Sandbox checklist: every **[?]** in `.claude/skills/grow/SKILL.md`. Above all: does the page collect the payer's name and phone when we omit them (ADR 0019 decision 3); does `chargeType=3` hold 1 ILS; is `cardToken` in `getPaymentProcessInfo`; what does `getTokenTransactionsByExternalIdentifiers` return for an id never used; and which error code does a duplicate `transactionUniqueIdentifier` return. Record each body in `wire-examples.md`.

Delivers: a real card checkout in Grow's sandbox activates a subscription.

### 14. RevenueCat adapter and external mode. Deferred to v2 (decided 2026-10-14)

Not part of v1. Kept here so the port and schema stay shaped for it: `scheduleOwner` and the `signedWebhooks` / `providerManagedSchedule` capability flags are in the spec and cost nothing, so slices 4 and 5 keep them. Every v1 row is `scheduleOwner: self`, and no v1 code path handles `external`.

Blocked by: 10, 13 for the layering pattern.

Spec: Spec 1 external mode section, D11.

- [ ] Adapter with `signedWebhooks: true`, `providerManagedSchedule: true`.
- [ ] Store notifications normalised to lifecycle events. Grace maps to `past_due`, expiry to `canceled`. Charges recorded with `source: external`, dedup on store transaction id.
- [ ] API cancel, resume, update-payment-method return `409` for external subscriptions.
- [x] Tests: each client method against the real app through `app.request()` passed as `fetch`, so the SDK is tested against the server and not a mock. A response with a missing or mistyped field fails the parse. A field the contract does not know yet is ignored, so an additive server change breaks no installed SDK, and the server's no-extra-fields guarantee stays in `contract-conformance.test.ts`. A tampered body, a wrong secret, a replayed signature, a stale or future timestamp and a malformed event each reject. An event the real drainer delivered verifies. Every route in the router has an SDK method.

Delivers: an App Store subscription mirrored into the same four states.

---

## Phase 5: The tenant side

### 15. Receiver in job-platform

Blocked by: 6, 9, 23.

Spec: `spec/outbox-delivery.md` receiver contract. Resolves PRD open question 5, the PRODUCT:HIGH downgrade.

- [ ] Endpoint in job-platform: verify HMAC, reject timestamps older than 5 minutes, respond 2xx first, dedup by event id, upsert a `subscription_status` mirror by sequence.
- [ ] Product decision: what an employer loses when `entitled` becomes false, and when. Recorded as an ADR in job-platform.
- [ ] Use the SDK (slice 23) for the API calls and for verifying and parsing events. One type on both sides of the wire.

Delivers: the first real tenant reacts to a real event.

### 23. Typed SDK

Blocked by: 4, 6, 9, 11. Its surface is every tenant-facing route and every outbound event, so it waits until those exist.

Added 2026-10-16, in v1. Context: `docs/product/hosted-service-strategy.md` section 6, developer experience. job-platform (15) is its first user.

A tenant integrates through one package and never hand-writes a request body, a response type or an HMAC check. Every type comes from `src/contract`, so the SDK cannot drift from the server.

- [x] Decision (ADR 0015, 2026-10-16): a hand-written thin client over `fetch`, one method per route, requests validated and responses parsed with the contract's zod schemas. No codegen step; a test enumerating the routes catches a missing method. OpenAPI generation (B) is deferred until a non-TypeScript tenant needs a spec. Hono's `hc` client is ruled out: it types against the route tree, which drags `src/api` and hono into a package tenants install.
- [x] Decision (2026-10-17): packaging. A workspace package, `packages/sdk`, built with tsup. The build inlines the `src/contract` schemas, so the published package depends on zod only, and the layer lint keeps its source to zod and `src/contract`. Entry points are separate files (`create-client`, `payment-service-error`, `verify-and-parse-event`, `event-verification-error`), with no barrel.
- [ ] Publish `@payment-service/sdk` to a private registry and settle the name. Until then the docs page marks the SDK as preview.
- [x] Client: `createClient({ baseUrl, apiKey, fetch? })`, with methods for plans, customers, subscriptions (create, get, cancel, resume, update payment method). Errors surface as a typed `PaymentServiceError` carrying the problem+json, not a thrown `Response`. Invalid input throws before a request is sent.
- [x] Idempotency: every mutating method takes an optional `idempotencyKey` and generates one when absent. A generated key is new on every call and is reused across the SDK's own retries. A caller's own retry is safe only with a key the caller keeps.
- [x] Decision (2026-10-17): the SDK retries by itself, always with the same idempotency key. Two retries on a network error, a timeout, 502, 503 or 504, with a jittered exponential delay (about 200ms, then 400ms). Never on any other status, 500 included. Every attempt has a 30 second timeout. Options: `retries`, `timeoutMs`, and `sleep` (a test hook).
- [x] Webhooks: `verifyAndParseEvent(rawBody, headers, secret, now)` checks the HMAC and the 5-minute timestamp window, then parses with the outbound-event contract. The header names, the tolerance and the signed string live in `src/contract/event-signature.ts` and are imported by the server and the SDK. Each side makes its own HMAC call, because the contract may not import `node:*`. The event `type` is a closed enum, so an exhaustive `switch` on it is a compile-time check in the tenant.
- [x] Tests: each client method against the real app through `app.request()` passed as `fetch`, so the SDK is tested against the server and not a mock. A response with a missing or mistyped field fails the parse. A field the contract does not know yet is ignored, so an additive server change breaks no installed SDK, and the server's no-extra-fields guarantee stays in `contract-conformance.test.ts`. A tampered body, a wrong secret, a replayed signature, a stale or future timestamp and a malformed event each reject. An event the real drainer delivered verifies. Every route in the router has an SDK method.

Delivers: a tenant installs one package and gets typed calls, safe retries and verified, typed events.

What you learn: why the contract layer is zod-only and separate from `src/api`, and what that separation buys the moment a second repo consumes it.

### 16. Production deploy

Blocked by: 0.6, 12, 13, 15, 17, 20.

- [ ] Cloud Scheduler jobs for the four crons and the drainer, declared in the Pulumi program (0.6).
- [ ] Secrets, tenant onboarding runbook, redrive runbook.
- [ ] Cloud Run gets `PUBLIC_BASE_URL` and `GROW_BASE_URL` (production Grow URL), and `GROW_API_KEY` from Secret Manager once the Grow platform agreement exists (slice 13). Without the first two the service refuses to boot.
- [ ] Smoke test through the test tenant (17), in production if 17 decides it lives there.

### 17. Test tenant

Blocked by: 6, 13.

A tenant used only for tests. It has no real customers and moves no real money, and its card payments go through the provider's sandbox. It lets the full loop (checkout, webhook, charge, outbox delivery) run against a deployed service. The integration suite does not use it: `tests/utils/tenant-fixtures.ts` already creates tenants per test. It is runtime data like any other tenant, and the code never names it.

- [ ] Decision: where its events go. A small sink service deployed by the Pulumi program, or a sink route inside this service behind `/internal`. The first keeps test traffic out of the product; the second is one deploy less.
- [ ] Decision: whether it also lives in production. Provider credentials are app-level today, so a sandbox tenant in production needs per-tenant provider config (which selling to several tenants needs anyway). Without that, it lives in staging only and slice 16's smoke test runs there.
- [ ] Provisioned by `pnpm db:seed` flags or the onboarding runbook, idempotently, with its own plan.
- [ ] A smoke script that runs the loop end to end against a base URL and asserts the sink received a signed `subscription.activated`.

Delivers: one command proves a deploy works for money, not just for `/health`.

---

## Phase 6: Hardening

### 18. Chaos testing

Blocked by: 6, 8, 10, 12.

The money-safety claims (one charge per period, every state change has exactly one outbox row, a lost webhook is repaired) are proven per slice under happy concurrency. This slice breaks things on purpose and checks the claims still hold.

- [ ] Fault-injecting wrappers over the fake provider and the fake tenant endpoint: timeouts after the provider already charged, 5xx, slow responses, duplicated and reordered webhooks.
- [ ] Crash points from ADR 0008: between tx1 and `provider.charge`, between the charge and tx2. The pending row must settle through reconcile, never charge twice.
- [ ] Database faults: connection killed mid-transaction, two cron and drainer instances racing, clock skew between instances.
- [ ] Invariant checks run after every scenario: at most one `succeeded` charge per (subscription, period), outbox sequence gapless per subscription, no subscription in a state the machine cannot reach.
- [ ] Optional: the same scenarios against staging with the test tenant (17) and a network fault proxy.

Delivers: a list of failure modes, each with a test showing the system recovers without losing or doubling money.

What you learn: why idempotency keys, unique indexes and reconcile are three layers of the same defence, and which one catches each fault.

### 24. Refactors left open by slices 11 and 12

Blocked by: none. One commit, no behaviour change: the suite must stay green with no test edited.

- [ ] Transition table on `EFFECT.*` keys. `effects.ts` became a const object in slice 11 (audit finding: `'retry_now'` was a bare literal), but `transition-table.ts` still spells every effect as a string. The `Effect` type is unchanged, so this is a mechanical swap.
- [ ] `chargeOne` finds its provider through `providerForConnectionId` (slice 12) instead of its own inline lookup.
- [ ] `startCycleCharge` loads tenant, customer and plan through `findCycleParties` (slice 12) instead of its own three lookups.

Delivers: one definition of each effect, provider lookup and party lookup.

---

## Phase 7: Roadmap after v1

Added 2026-10-16, slices 25 and 26 on 2026-10-17. Not v1 work. No slice here has an ADR yet; each starts with one.

### 21. Sandbox mode

Blocked by: 8, 10, 17, 19.

Context: `docs/product/hosted-service-strategy.md` section 6, developer experience. Absorbs slice 17's production decision.

Stripe's model: every application has a test key and a live key, every object records which mode created it, test and live data never meet, and test clocks let a developer move time forward. A tenant integrates and rehearses renewal and dunning without moving real money and without waiting a month.

- [ ] Decision (ADR): how a mode is stored. **A.** A sandbox application is a sibling `tenants` row with `mode: sandbox`, linked to its live application. Isolation by `tenantId` already exists, so no money table gains a column, and a missed filter cannot leak across modes. **B.** One application and a `livemode` column on every row, as Stripe does. Closer to Stripe's API, but every query and every unique index must include the mode, and one missed filter mixes test data into live data. Recommendation: A.
- [ ] `provider_connections` gains `mode`. A sandbox application can only use a sandbox connection, enforced by the database the same way the organization boundary is (ADR 0010 composite key).
- [ ] API keys carry the mode in a visible prefix (`pk_test_`, `pk_live_`), so a key pasted in the wrong place is obvious in a log. Auth resolves the application, and the mode with it.
- [ ] Outbound events carry `livemode`, and each mode has its own webhook URL and secret, so a receiver can drop a test event that reaches its live endpoint.
- [ ] A simulated provider connection: the fake provider behind magic card tokens (always succeeds, always declines, declines on the second charge). A tenant can try the API before it has a Grow sandbox account.
- [ ] Test clocks: a sandbox-only endpoint that advances one subscription's clock and runs renewal, dunning and housekeeping for it. The crons already take `now`, which is why this is cheap. A live key gets `404`, not `403`, so the route doesn't reveal itself.
- [x] Tests: each client method against the real app through `app.request()` passed as `fetch`, so the SDK is tested against the server and not a mock. A response with a missing or mistyped field fails the parse. A field the contract does not know yet is ignored, so an additive server change breaks no installed SDK, and the server's no-extra-fields guarantee stays in `contract-conformance.test.ts`. A tampered body, a wrong secret, a replayed signature, a stale or future timestamp and a malformed event each reject. An event the real drainer delivered verifies. Every route in the router has an SDK method.

Delivers: a tenant integrates end to end, renewal and dunning included, in an afternoon and without real money.

What you learn: why Stripe isolates modes at the key, and why isolation by row (A) fails safer than isolation by filter (B).

### 22. Stripe adapter

Blocked by: 13 for the layering pattern, 19. Better after 21, because Stripe's test keys are the natural sandbox connection.

Context: the wedge in `docs/product/hosted-service-strategy.md` section 2 is cheaper local acquirers, so Stripe is not the second Israeli acquirer that section 6 asks for. It serves organizations that bill through a foreign entity, and it is the first provider with signed webhooks and a schedule we own. That combination is untested by Grow (unsigned) and RevenueCat (signed, external schedule), so it checks that the port doesn't assume "signed means external".

Spec: PRD 5.1 capabilities, 5.2 rule 4, D11, ADR 0007, ADR 0008.

- [ ] Decision (ADR): credentials. **A.** The organization's restricted API key and webhook signing secret, sealed in `provider_connections` like Grow's. **B.** Stripe Connect, where we are the platform and the organization authorises us by OAuth. A gives one credential model across providers and keeps us outside the platform role. B gives smoother onboarding but changes the legal boundary in ADR 0010. Recommendation: A.
- [ ] First cut (ADR 0020): `src/infra/stripe/stripe-client.ts` over the injected `fetch` (no SDK), `src/lib/payments/stripe/*` implementing `PaymentProvider` with `{ secretKey }` credentials, setup-mode checkout on a pre-created customer, off-session PaymentIntents keyed by the dedup key, lookup by id or metadata search, and unsigned webhooks trusted by re-fetching the session. `STRIPE_BASE_URL` config, `stripe` in the `payment_provider` enum, wired into `buildProviderFrom`. Tests: unit tests per port method against a fake fetch, plus a build-provider case.
- [ ] Follow-up: pass request headers to `parseWebhook` (port change), verify `Stripe-Signature`, then flip `signedWebhooks` to `true`. `refunds: true` waits for a refund method on the port.
- [ ] Checkout is a Stripe Checkout session in `setup` mode with our checkout reference in its metadata. It saves a payment method and charges nothing, which is what ADR 0007 needs.
- [ ] Charges are off-session PaymentIntents. Our dedup key (`subscriptionId:periodEnd:attempt`) is sent as Stripe's `Idempotency-Key`, so a retry after a timeout charges once at Stripe too. The amount comes from the plan row.
- [ ] Inbound webhooks verify `Stripe-Signature` against the connection's signing secret and dedup on the Stripe event id. Under D11 a verified `payment_intent.succeeded` settles a charge without a verify call. Reconcile still calls `verifyCharge`.
- [ ] Off-session charges can fail with `authentication_required` (SCA). Decide whether it is an ordinary failure that runs dunning, with update payment method (slice 11) as the rescue, or a distinct reason exposed to the tenant.
- [ ] Check ILS against ADR 0004: minor units and Stripe's minimum charge amount.
- [x] Tests: each client method against the real app through `app.request()` passed as `fetch`, so the SDK is tested against the server and not a mock. A response with a missing or mistyped field fails the parse. A field the contract does not know yet is ignored, so an additive server change breaks no installed SDK, and the server's no-extra-fields guarantee stays in `contract-conformance.test.ts`. A tampered body, a wrong secret, a replayed signature, a stale or future timestamp and a malformed event each reject. An event the real drainer delivered verifies. Every route in the router has an SDK method.

Delivers: an organization with a Stripe account bills subscriptions through it with the same lifecycle, events and contract as Grow.

What you learn: what a signed webhook lets you skip, and what it still doesn't let you trust (the amount).

### 25. Provider overload

Blocked by: 10, 12, 13. Slice 13 shows which status codes and error bodies Grow actually returns under load.

Context: Grow credentials belong to the organization's merchant account (ADR 0010), and its rate limits most likely apply per merchant or terminal, not per key. Rotating or minting keys to get past a limit doesn't raise it, likely breaches Grow's terms, and putting several organizations behind one key is the payment aggregation ADR 0010 forbids. Credential rotation is for a compromised key, never for load. Overload is handled by slowing down and sorting failures, per connection.

- [ ] Ask Grow for its rate limits and their scope (per terminal, per account, per key). Record the answer; no limit is invented in code.
- [ ] Decision (ADR): sorting provider failures. **Refused** (`429`, connection refused, a documented "not processed" error): nothing was charged, so a retry is safe. **Ambiguous** (`5xx`, timeout): the charge stays `pending` and reconcile settles it (ADR 0017). Grow has no idempotency, so an ambiguous failure is never retried automatically.
- [ ] Decision (same ADR): a refused attempt does not use up a dunning attempt. Without that, a Grow outage pushes healthy customers toward cancellation. **A.** The charge row is cancelled with no attempt counted, and the next run tries the same attempt again. **B.** A separate `deferred` status on the charge. A needs no new state; B makes outages visible in the data. Recommendation: A, with a metric for visibility.
- [ ] A circuit breaker keyed by `providerConnectionId`. After N refused or ambiguous calls in a window, renewal, dunning and reconcile skip that connection's rows for the run. They wait an hour, still inside Spec 2's day-level contract (ADR 0013). One organization's overloaded account never slows another's.
- [ ] Customer-facing calls (checkout, update payment method) on an open breaker or a refused call return `503` problem+json with `Retry-After`. The SDK retries with the same idempotency key (slice 23); confirm it treats `503` as retryable and honours `Retry-After`.
- [ ] Tests: a refused renewal leaves no live charge and the same attempt runs next time; an ambiguous one stays `pending` and is never retried by renewal; a dunning attempt is not used up by a refused call; an open breaker on connection X skips X's rows and still charges connection Y's; checkout on an open breaker is `503` with `Retry-After`.

Delivers: a Grow outage or throttle delays charges by hours instead of double-charging, cancelling, or spreading to other organizations.

What you learn: why a payment system's retry policy hinges on "definitely not charged" versus "maybe charged", and why isolation belongs to the resource that owns the limit.

### 26. API keys with overlapping rotation

Blocked by: 19. Better before 21, which then only adds the mode prefix to this table.

Context: each application has a single `tenants.apiKeyHash`, shown once by the seed CLI. Replacing it means downtime, and a leaked key can't be retired without breaking the integration. Keys stay per application on purpose: the key resolves which plans, `webhookUrl` and events a request acts on, and one leaked key exposes one application, not a whole organization. Organization-level keys for management (creating applications, rotating keys) come with the dashboard (`docs/product/hosted-service-strategy.md` section 6) and are not in this slice.

- [ ] Decision (ADR): where keys live. **A.** An `api_keys` table: `tenantId`, hash, visible prefix, `createdAt`, `lastUsedAt`, `revokedAt`. Several live keys per application. **B.** Two columns on `tenants` (current and previous hash). A allows any number of keys, audit, and per-key revocation; B is smaller but caps overlap at two and loses history. Recommendation: A.
- [ ] Rotation is create, deploy, revoke: a new key works next to the old one until the tenant revokes the old one. A revoked key is `401`, the same as an unknown key, so a revoked key reveals nothing.
- [ ] `lastUsedAt` is written at most once per interval per key, not on every request, so auth stays a single read on the hot path.
- [ ] The seed CLI prints the webhook secret next to the API key, closing the gap left by slice 23.
- [ ] A CLI command to issue and revoke keys for an application, until self-serve onboarding exists.
- [ ] Tests: two live keys both authenticate as the same application; a revoked key is `401`; a key from application A never resolves application B; the plaintext key is never stored or logged; `lastUsedAt` is throttled.

Delivers: a tenant replaces a leaked or departing developer's key with no downtime.

What you learn: why a credential needs a lifecycle (issue, overlap, revoke) and not a single column.

---

## Frontier at start

Slices with no unfinished blockers right now: **0.0**. After 0.0, slices **0.1**, **3**, and **7** open up, and 3 and 7 are pure modules you can write while the toolchain settles.

## Deliberately not in the plan

Plan changes, trials, proration, multi-currency, hard-decline short-circuiting, refunds, alerting on dead letters, and the RevenueCat adapter with external mode (slice 14, v2). All listed as out of scope in `PRD.md`. The `refunds` capability flag exists in the port but no slice implements a refund.

Hosted-service gaps (invoicing, onboarding, dashboard, a second Israeli acquirer, legal and operations) are listed in `docs/product/hosted-service-strategy.md` section 6 and are not slices yet. The typed SDK is slice 23, in v1. Sandbox mode (21), the Stripe adapter (22), provider overload (25) and API key rotation (26) are roadmap slices in phase 7.

Also deferred: the fallback for providers without `saveCardWithoutCharge` (charge at checkout, plus refund-on-conflict). It depends on the refund flow above. Until it exists, such providers fail the boot guard. See ADR 0007 and PRD open question 6.
