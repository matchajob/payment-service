# Code review 1: whole codebase (2026-10-17)

Scope: all of `src/`, `tests/`, `iac/`, `drizzle/`, specs and ADRs in the working tree. Commits landed during the review, so the state is `0d9d9f2` through `15fd99d` (slice 12 settle CLI, slice 23 SDK).

## How the review was done

- Round 1 split the code into areas: charging, lifecycle, delivery, API surface, house rules, and money flow (each charge path crashed at every step).
- Round 2 used lenses that cut across those areas: lifecycle journeys, a spec conformance matrix, time and concurrency, failure handling, the tenant contract, test effectiveness, and the data model.
- A separate session (payment-service-9f) ran the security review. Its items are marked *(sec)*.
- Every finding marked **✔** was checked against the code by the coordinator. Unmarked ones are reviewer reports that were not re-checked.
- Evidence: typecheck clean, lint clean, 675/675 tests green. Prettier flags `tests/integration/sdk/plans-and-customers.test.ts` and `vitest.config.ts`.

## Tracker

Final severities after the independent review. To mark a row fixed, change `[ ]` to `[x]` and put the commit SHA in **Commit**. For accepted risks that you decide not to change, write `[-]` and a reason in **Commit**.

**Type:**
- **Bug:** the code is wrong.
- **Gap:** a missing piece or an open design question.
- **Gate:** must be designed before slice 13 (the Grow adapter).
- **Accepted:** an ADR chose this; worth revisiting.
- **Pre-deploy:** blocks only the first deploy.

IDs `N1`… are findings that had no number in the sections below.

| Done | # | Sev | Domain | Finding | Type | Commit |
|---|---|---|---|---|---|---|
| [x] | H1 | **High** | Charging | No subscription renews after charge #1: it shares `(sub, P1, 0)` with the first renewal | Bug | `65ceb77` |
| [x] | H4 | **High** | Charging / Reconcile | 100 failing rows block renewal, dunning and reconcile for every tenant | Bug | `ddf879b` |
| [ ] | M6 | **High** | Lifecycle | `active` and `entitled: true` while charge #1 is pending, forever if it's flagged | Bug | |
| [x] | H2 | Medium | Reconcile | Card-update retry times out, reconcile settles it as a scheduled retry, customer canceled | Bug | `65ceb77` |
| [ ] | M9 | Medium | Reconcile | A `late_success` flag can never be cleared; a late-succeeded charge #1 leaves a payer canceled | Bug | |
| [ ] | M10 | Medium | Reconcile / Lifecycle | A flagged charge blocks cancel with no time limit | Gap | |
| [ ] | H3 | Medium | Provider port | `ChargeResult` has no error branch, so an adapter could turn a credential failure into a mass decline | Gate | |
| [ ] | M25 | Medium | Webhooks | A garbage body makes `parseWebhook` throw: 500, provider retries forever (breaks Spec 4 r6) | Bug | |
| [ ] | M1 | Medium | Webhooks | Event marked processed on `NOT_COMPLETED`, so the redelivery is dropped and the signup lost | Bug | |
| [ ] | N1 | Medium | Webhooks / Housekeeping | Expiring a checkout doesn't expire it at the provider; a stale tab saves a card with no subscription | Gap | |
| [ ] | M2 | Medium | Idempotency | The hash covers the body only, so the same key across subscriptions replays the wrong response | Bug | |
| [ ] | H5 | Medium | Data model | Nothing in the database stops a plan being repriced; renewals read the live price | Gap | |
| [ ] | M13 | Medium | Data model | Tenant integrity not enforced: foreign keys use the id only, and a charge can point at another subscription's card | Gap | |
| [ ] | M14 | Medium | Data model | No append-only audit trail; the settle CLI leaves no actor or reason | Gap | |
| [ ] | M15 | Medium | Data model | Hot queries have no index (renewal due, expired checkouts, lost and pending charges) | Gap | |
| [ ] | H7 | Medium | Events | Charge events carry no amount, attempt, reason or next retry date | Gap | |
| [ ] | M17 | Medium | Events | `charge.failed` and `past_due` share one snapshot and are sent in parallel, so a tenant drops one | Gap | |
| [ ] | M18 | Medium | Events | Cancel, resume and recovery emit no event; GET has no `sequence` | Gap | |
| [ ] | M19 | Medium | Events / SDK | Strict enums and no `apiVersion`: a new enum value dead-letters tenant events | Gap | |
| [ ] | M20 | Medium | API | Problem+json has no machine-readable `code`; no list endpoints or pagination; no lookup by `externalRef` | Gap | |
| [ ] | M21 | Medium | API | GET lacks what a billing UI needs: amount, next charge date, dunning state, card last4 | Gap | |
| [ ] | M11 | Medium | Ops | Cron always returns 200; no time budget; no provider call timeouts anywhere | Bug | |
| [ ] | M22 | Medium | Ops | No SIGTERM drain or pool close | Gap | |
| [ ] | M23 | Medium | Ops | Dead letters, ignored webhooks and ignored card updates aren't logged (breaks D13 and Spec 1) | Bug | |
| [ ] | M24 | Medium | Ops / CLI | Settle CLI doesn't verify the ref or amount, and has no confirm or operator; redrive has no cap | Gap | |
| [ ] | N2 | Medium | Ops / CLI | Seed has no way to add a plan, which pushes operators towards `UPDATE plans` | Gap | |
| [ ] | N3 | Medium | Security | Seed prints the API key to stdout and takes provider credentials as arguments | Bug | |
| [ ] | N4 | Medium | CI | No CI for the app: tests, typecheck and lint never run on push | Gap | |
| [x] | M27 | Medium | Tests | Seeders build states the real flow never produces (no charge #1, no failed charges) | Bug | `48de2e6` |
| [x] | M28 | Medium | Tests | Fake provider ignores `dedupKey`; `verifyCharge` doesn't match earlier charges | Bug | `48de2e6` |
| [x] | M29 | Medium | Tests | Weak assertions in the cron, reconcile-concurrency and safety tests | Bug | `48de2e6` |
| [ ] | M26 | Low–Med | Security / Infra | A push to any branch runs `pulumi preview` as the staging deployer | Accepted (0012) | |
| [ ] | N5 | Low–Med | Security | Cipher doesn't bind a credential to its connection (no AAD); no key id, so no rotation | Gap | |
| [ ] | M4 | Low | Idempotency | `startCheckout` runs inside the transaction (only the missing timeout is open) | Accepted (0006) | |
| [ ] | M3 | Low | Idempotency | `completeKey` unfenced; 90s reservation vs 300s request timeout | Bug | |
| [ ] | N6 | Low | Idempotency | Abandoned reserved keys are never purged | Bug | |
| [x] | M5 | Low | Webhooks | Identical webhooks run at the same time (money safe; no test) | Gap | `48de2e6` |
| [ ] | M8 | Low | Reconcile | `not_found` for 24h, then failed, then recharged under a new key | Accepted (0017), gate | |
| [x] | N7 | Low | Reconcile | Oldest-first starvation while the provider keeps saying pending | Bug | `ddf879b` |
| [ ] | M12 | Low | Charging | `attemptedAt` shared across a batch | Bug | |
| [ ] | M7 | Low | Charging | After an outage, catch-up charges land back to back (spacing undecided) | Gap | |
| [ ] | N8 | Low | Charging | `settle-cycle-charge` records a success but applies nothing if the transition is rejected | Bug | |
| [ ] | N9 | Low | Lifecycle | First-charge decline emits no `subscription.canceled` (PRD Q7) | Gap | |
| [ ] | N10 | Low | Lifecycle | Cancel on a canceled subscription returns `charge_in_flight` instead of 409 | Bug | |
| [ ] | N11 | Low | Lifecycle | Resume skips the `store_managed` check | Bug (v2) | |
| [ ] | N12 | Low | Time | Anniversary computed in UTC, not Israel time; billing hour shifts at DST | Gap | |
| [ ] | M16 | Low | Data model | Partial-index predicates are allow-lists | Gap | |
| [ ] | N13 | Low | Data model | `canceled_at` not tied to status; schedule JSON has no CHECK; plaintext `webhook_secret`; int4 amounts | Gap | |
| [ ] | N14 | Low | API / Contract | Handlers validate with lib schemas, not contract; contract lint is a denylist; USD accepted in v1 | Gap | |
| [ ] | N15 | Low | Events | No webhook secret rotation, no `v1=` prefix, no event-id header | Gap | |
| [ ] | N16 | Low | SDK | Fresh idempotency key per call, so a tenant's own retry duplicates a create | Accepted (SDK 0015) | |
| [ ] | N17 | Low | API | `with-tenant-subscription` locks the row before checking the tenant | Bug | |
| [ ] | N18 | Low | Outbox | `drainOutbox` uses `Promise.all`, so one failure discards the whole run report | Bug | |
| [ ] | N19 | Low | Security | Empty or `change-me` `CRON_SECRET` accepted | Bug | |
| [ ] | N20 | Low | Security | No `bodyLimit` and no webhook rate limit | Gap | |
| [ ] | N21 | Low | Security | Postgres in docker-compose bound to 0.0.0.0; confirm the infra deploy key is read-only | Gap | |
| [ ] | H6 | — | Infra / Deploy | Cron OIDC vs `CRON_SECRET`; secret never provisioned; KMS cipher still a stub | Pre-deploy | |
| [ ] | N22 | — | Infra / Deploy | `drizzle/` gitignored, so migrations are never committed | Pre-deploy | |
| [ ] | N23 | **Check now** | Governance | Working tree deletes `.claude/hooks/protect-src.sh` and `.claude/settings.json` | ? | |
| [ ] | N24 | Low | House rules | 46 repeated literals, 3 TODO comments, `findCycleParties` duplicated | Bug | |
| [ ] | N25 | Low | Docs | Superseded ADRs not annotated, PRD drift, two ADRs numbered 0015, no `GLOSSARY.md` | Gap | |

**Totals:** 3 High, 28 Medium, 2 Low–Medium, 24 Low, 2 pre-deploy, 1 to check now.

## Calibration after independent review (overrides the severities below)

An independent reviewer checked every High and Medium against the code and the ADRs. Corrections:

| id | Final | Why |
|---|---|---|
| H1 | **High** | Confirmed, deterministic. |
| H4 | **High** | Confirmed. The likeliest trigger is reconcile: `find-unsettled-charges` has no upper age bound. |
| M6 | **High** once charges can be flagged | GET grants unbounded unpaid entitlement. ADR 0015 broke ADR 0008's assumption. |
| H2 | Medium | Real, but it needs the immediate retry to land on the last slot *and* time out. ADR 0018 ¶1 accepts settling it as a scheduled retry, while wrongly claiming that "schedules the next retry". |
| H3 | Medium, slice-13 gate | A thrown error already takes the safe pending path. The risk is an adapter that maps errors to `failed`. The `not_found` → failed part is ADR 0017 decision X. |
| H5 | Medium | Reading the live plan is what D8 says. What's missing is a DB guard (a trigger or `REVOKE UPDATE`), not a price snapshot. |
| H7 | Medium | D12 and Spec 5 r3 define events as snapshot-only. Adding fields is non-breaking. |
| H6 | Pre-deploy checklist | Accepted by ADR 0012 and ADR 0010 amendment 8. |
| M1 | Medium, cost restated | Capture mode (ADR 0007 C1) moves no money, so the cost is a lost signup, not a paying customer canceled. |
| M4, M8 | Accepted by design | ADR 0006 (amended) and ADR 0017 §5–6. Only the missing provider timeout in M4 stays open. |
| M26 | Accepted by design, Low–Medium | ADR 0012: staging trusts branches, and only repo writers can push. |
| M3, M5, M7, M12, M16 | Low | Money is safe in each case. M7: Spec 2 already says cron lag isn't credited, so only the spacing of catch-up charges is open. |
| M9 | Narrowed | The real gap is that a `late_success` flag can never be cleared, so a late-succeeded charge #1 leaves a paying customer canceled. |

**Root-cause groups:**
- No error branch in the provider port: H3, M1, M8, M25.
- Human-only states with no time limit: M9, M10, M6-flagged.
- Event contract carries state only: H7, M17, M18, M21.
- No timeouts anywhere: M4, M11, M22, and ADR 0013's "~1s call" assumption.

### New findings from the independent review
- **No application CI (Medium).** `.github/workflows` has only `infra.yml`, so tests, typecheck and lint never run on push.
- **Governance (verify now).** The working tree deletes `.claude/hooks/protect-src.sh` and `.claude/settings.json`. That is the hook CLAUDE.md says enforces who writes `src/`.
- **Seed (Medium):**
  - `src/cli/seed.ts:121` logs the API key to stdout.
  - `seed-args.ts:71` takes provider credentials on argv, so they land in shell history and `ps`.
  - Seed always creates a new tenant, so there is no tool to add a plan. That pushes operators toward `UPDATE plans` (feeds H5).
- **Cipher (Low–Medium).** `local-credential-cipher.ts` uses no AAD binding the sealed blob to `providerConnectionId`, so a copied blob charges via the wrong merchant. There is no key id, so keys can't be rotated.
- **Checkout expiry (Medium).** Housekeeping cancels after the TTL, but the provider session never expires (the port has no TTL), so a stale tab saves a card with no subscription. `complete-checkout.ts` reads status without a lock and races housekeeping, silently ending as RACED.
- **Low:**
  - The SDK generates a fresh idempotency key per call, so a tenant's own retry duplicates a create.
  - `with-tenant-subscription.ts` locks the row before checking the tenant.
  - `settle-cycle-charge.ts` records a success but applies nothing if the transition is rejected.

### Correction to the H1/H2 recommendation
Option B as first written (`kind` in the unique indexes and the dedup key) would **add** a double-charge path:
- An `immediate_retry` and a `retry` for the same attempt could both go live.
- They would get different provider keys, which removes the DB tripwire and provider-side dedup that ADR 0018 d4 relies on.

Revised recommendation:
- **H1:** make period keying consistent. Every charge is keyed on the period it pays for: renewal and retries for period 2 at P2, and success sets `currentPeriodEnd = charge.periodEnd`. Alternatively, key charge #1 on the activation instant and rename the column.
- **H2:** add `kind` as a **non-unique** column used only to route settlement.
- Leave the unique indexes and the dedup-key format unchanged.
- Before prod this costs no migration. After launch, a dedup-key change would orphan in-flight pending charges.

Note on H3: `ChargeResult` is read as a binary in `record-charge-result`, `settle-first-charge` and all three `decide` functions. A new `error` variant would be recorded as a decline unless every one of those changes. Typed thrown errors on the existing pending path are safer.

## Severity

- **High:** loses money, charges wrongly, grants unpaid access, cancels a payer, or blocks all billing.
- **Medium:** a correctness or operability defect with a realistic trigger.
- **Low:** hardening, drift, or polish.

---

## High

### H1 ✔ No subscription ever renews after charge #1
- Location: [activate-checkout.ts:57-75](../../src/lib/subscriptions/activate-checkout.ts), [no-live-charge-for-current-period.ts:15](../../src/lib/charge-cycle/no-live-charge-for-current-period.ts), [start-cycle-charge.ts:36](../../src/lib/charge-cycle/start-cycle-charge.ts).
- Cause:
  - Charge #1 is stored at `(sub, periodEnd=P1, attempt 0)`, and success does not advance the period.
  - At P1, renewal sees a live charge for `currentPeriodEnd` and skips. The unique indexes `charges_one_live_per_period` and `charges_one_per_attempt` would block the insert anyway.
  - The dedup key `sub:P1:0` collides the same way.
- Outcome: the customer pays once and keeps access forever.
- Found independently by 3 reviewers.
- ADR 0008 (one live per period) contradicts ADR 0017 §31 (charge #1 and the renewal both at P1).

### H2 ✔ Reconcile cancels a customer whose fresh-card retry timed out
- Location: [settle-reconciled-charge.ts:27](../../src/lib/reconcile/settle-reconciled-charge.ts), [charge-kind-of.ts:11](../../src/lib/reconcile/charge-kind-of.ts), [dunning-cycle.ts:31-48](../../src/lib/dunning/dunning-cycle.ts).
- Sequence: with schedule [1,3,7], attempts 0–2 fail and the customer updates the card. The immediate retry (attempt 3) times out. Reconcile later settles it as failed.
- Cause: `chargeKindOf` says RETRY, so `dunningCycle.decide` runs instead of `immediateRetryDecide`. The schedule index is 4, past the end, which gives `FINAL_RETRY_FAILED`.
- Outcome: the subscription is canceled. Spec row 14 says it should stay `past_due` with the clock reset.

### H3 ✔ Provider errors are indistinguishable from card declines
- Location: [provider.ts:26-28](../../src/lib/payments/provider.ts), [reconcile-charge.ts:44](../../src/lib/reconcile/reconcile-charge.ts).
- `ChargeResult` is only `succeeded | failed`.
- An adapter that maps 401, 403, 429 or 5xx to `failed` turns a revoked Grow credential into a mass decline: every subscription of that tenant enters dunning and is canceled. A failed charge #1 cancels the subscription immediately.
- `not_found` after 24h is likewise recorded as a decline.
- Fix this before the Grow adapter is written (slice 13): add a non-settling `error` outcome and typed provider errors.

### H4 ✔ Poison rows starve renewal, dunning and reconcile for every tenant
- Location: [find-due-renewals.ts:24-25](../../src/lib/renewal/find-due-renewals.ts), `find-due-retries.ts`, `find-unsettled-charges.ts`.
- Each query takes rows oldest first, `LIMIT 100`, with no failure marker.
- A row that throws rolls back and stays at the head of the queue. Causes include a missing card, missing parents, a credential decryption failure, and a bad dunning schedule.
- 100 such rows, for example one tenant with a broken connection, stop billing for all tenants.
- Found independently by 2 reviewers.

### H5 ✔ Renewals charge the live plan price, and plans are not enforced immutable
- Location: [start-cycle-charge.ts:70-71](../../src/lib/charge-cycle/start-cycle-charge.ts), [insert-immediate-retry-charge.ts:36](../../src/lib/payment-method-updates/insert-immediate-retry-charge.ts).
- There is no price snapshot on the subscription and no database guard on `plans`.
- One `UPDATE plans` reprices, or changes the currency for, every existing subscriber at their next renewal.
- D8 is enforced only by the absence of an update route, and no test covers it.

### H6 ✔ Production deploy cannot work *(sec + surface)*
- Location: [server.ts:18](../../src/api/server.ts), [cron-auth.ts:17](../../src/api/cron-auth.ts), `iac/scheduler-jobs.ts:31`, `iac/cloud-run-service.ts:52-61`.
- The scheduler sends a Google OIDC token, but the app compares it to a static `CRON_SECRET`.
- The infrastructure code never provisions `CRON_SECRET`, so the server throws at boot.
- `PROVIDER_CREDENTIALS_KMS_KEY` selects the stub KMS cipher, so every provider call fails until slice 20.
- ADR 0012 records the swap as pending. It is listed here because it blocks any deploy.

### H7 ✔ Charge events carry no charge data
- Location: [outbound-event.ts](../../src/contract/outbound-event.ts), `subscription-snapshot.ts`.
- `charge.succeeded` and `charge.failed` have no amount, currency, attempt number, reason, chargeId or next retry date.
- A tenant cannot send a receipt or a dunning email, or reconcile revenue.

---

## Medium

### Money and state
- **M1 ✔ Webhook dropped permanently on `NOT_COMPLETED`** ([webhooks.ts:46](../../src/api/routes/webhooks.ts)).
  - The event is marked processed, and a byte-identical redelivery is deduplicated away.
  - Housekeeping then expires the checkout without asking the provider, so a customer who paid is canceled.
- **M2 ✔ Idempotency hash covers the body only** ([idempotency.ts:155](../../src/api/idempotency.ts)). *(also sec)*
  - The same key on `cancel` for subscription A, then for B, replays A's response, and B is never canceled.
- **M3 ✔ `completeKey` is unfenced** ([complete-key.ts](../../src/lib/idempotency/complete-key.ts)).
  - The reservation lasts 90s but Cloud Run allows 300s per request, so a slow request and its retry both run, and the late one overwrites the stored response.
- **M4 ✔ `startCheckout` runs inside the idempotency DB transaction** ([idempotency.ts:172](../../src/api/idempotency.ts), [create-subscription.ts:46](../../src/lib/subscriptions/create-subscription.ts), [start-payment-method-update.ts:48](../../src/lib/payment-method-updates/start-payment-method-update.ts)).
  - It breaks the "no transaction across a network call" rule.
  - A slow Grow can exhaust the pool. There is no provider timeout anywhere.
  - It assumes capture mode never charges, which is unverified.
- **M5 ✔ Identical webhooks are processed concurrently** ([webhooks.ts:26-46](../../src/api/routes/webhooks.ts)).
  - Money is safe because the `RACED` guard and the charge dedup key stop a second charge, but nothing claims the event first, and no test covers it.
- **M6 ✔ `active` before charge #1 settles** ([activate-checkout.ts:58](../../src/lib/subscriptions/activate-checkout.ts)).
  - GET returns `entitled: true` while charge #1 is pending: up to 24h for `not_found`, 7 days for a stuck pending charge, and forever if the charge is flagged.
  - ADR 0015 makes GET the tenant's repair path, so a tenant can grant entitlement nobody paid for. This contradicts Spec 1 ("active = paid through").
- **M7 ✔ A renewal cron outage longer than one period gives back-to-back charges** ([next-period-end.ts](../../src/lib/subscriptions/next-period-end.ts)).
  - D7 advances from the old period end, which is still in the past, so the next hourly run charges again.
  - The spec is silent on catch-up. **Product decision needed.**
- **M8 Reconcile settles `not_found` after 24h as failed, then dunning recharges under a new key** ([reconcile-charge.ts:44](../../src/lib/reconcile/reconcile-charge.ts)).
  - If Grow's lookup is slow to catch up, the customer is charged twice.
  - It is safe only if slice 13 proves that `not_found` is final.
- **M9 ✔ A late success has no recovery path** ([settle-flagged-charge.ts:18](../../src/lib/reconcile/settle-flagged-charge.ts)).
  - The charge is `failed` and the CLI only accepts `pending`.
  - There is no refund path, no outbox event and no metric; the only signal is a log line.
- **M10 Any flagged or pending charge blocks cancel.**
  - A provider `pending` can last 7 days and a flagged charge stays until someone settles it by hand.
  - ADR 0017 §2's own motive (don't block cancel for 48h) is defeated by its own windows.
- **M11 ✔ Cron endpoints always return 200** ([cron.ts:21-35](../../src/api/routes/cron.ts)).
  - Partial failure never alerts. There is no time budget and no per-call timeout.
- **M12 `attemptedAt` is one `now` for a whole batch of up to 100 charges.**
  - Later charges look older than they are, so the 15-minute in-flight guard and the 24h grace understate their age.

### Data model
- **M13 Tenant integrity is not enforced in the DB.**
  - FKs are on the id only, so a row can reference another tenant's plan, customer or subscription.
  - A charge can reference another subscription's card or a replaced one.
  - Fix: composite `(tenant_id, id)` FKs.
- **M14 No append-only audit trail.**
  - Charges are mutated in place, and the settle CLI flips status with no actor or reason.
  - There is no `settled_at`. A chargeback dispute cannot be evidenced.
- **M15 Hot queries have no index:** renewal due, expired checkouts, lost charges, pending charges, and `idempotency_keys.completed_at`.
- **M16 Partial-index and CHECK predicates are allow-lists.** A new status, such as `refunded`, silently escapes the uniqueness rules.

### Tenant contract
- **M17 `charge.failed` and `subscription.past_due` carry the same snapshot and are delivered in parallel.**
  - A tenant ordering by sequence drops `charge.failed`, and with it its email side effect.
- **M18 Cancel, resume, recovery and card replacement emit no event.**
  - GET has no `sequence`, and the flag changes without a sequence bump.
- **M19 Strict `z.enum` and no `apiVersion`.**
  - Adding any enum value breaks tenant parsing, and the event dead-letters after about 27h.
- **M20 Problem+json `type` is always `about:blank`.**
  - Causes such as `charge_in_flight` appear only in free text. There are no list endpoints, no pagination envelope, and no lookup by `externalRef` (a 409 on a duplicate customer does not return the id).
- **M21 GET cannot render billing UI.** It has no amount, next charge date, dunning state, or card brand/last4.

### Operability
- **M22 No SIGTERM drain or pool close** ([server.ts:25](../../src/api/server.ts)).
- **M23 Dead-lettering is silent** (Spec 5 rule 7 / D13 "loud in logs"). Ignored webhooks are not logged (Spec 1, Spec 4 rule 6), and an ignored card update is not logged.
- **M24 The settle CLI does not check `--succeeded <ref>`** against the provider, the amount, or uniqueness. It has no confirm step and no operator or reason.
  - The redrive CLI has no cap or confirm, and replays `LEASE_EXPIRED` events that may already have been delivered.
- **M25 `parseWebhook` throwing on a garbage body returns 500**, so the provider retries forever.

### Security *(sec)*
- **M26 ✔ A push to any branch can take over the staging GCP project.**
  - Location: [deployer-trust-condition.ts:12-14](../../iac/deployer-trust-condition.ts), [infra.yml](../../.github/workflows/infra.yml).
  - `pulumi preview` executes the branch's code as a deployer that can change IAM and manage secrets and KMS.
  - Confirm staging and prod are separate projects. Give previews a read-only identity.

### Tests (Claude-owned)
- **M27 Seeders build impossible state.**
  - `renewal-rows.ts` has no charge #1; `dunning-rows.ts` has no failed charges.
  - This is why H1 and H2 survived 600+ green tests.
- **M28 The fake provider ignores `dedupKey`**, and `verifyCharge` is unrelated to prior `charge` calls.
  - It cannot model "timed out but processed".
  - An unscripted call throws, which the runners count as `failed: 1`.
- **M29 Weak assertions:**
  - `cron-renew.test.ts` checks only the status and counts.
  - `reconcile-concurrency.test.ts` never checks the verify count or final statuses.
  - The safety tests catch a double charge only via an exception from the fake.

---

## Low

- **Idempotency:** abandoned reserved keys are never purged. `drainOutbox` uses `Promise.all`.
- **Reconcile:** oldest-first starvation when the provider keeps saying pending (LEFT rows).
- **Lifecycle:**
  - A first-charge decline emits no `subscription.canceled` (PRD Q7 undecided).
  - Cancel on a canceled subscription returns `charge_in_flight` instead of 409.
  - Resume skips the `store_managed` check (v2).
- **Time:** the anniversary is computed in UTC. Activating at 00:30 Israel time on the 1st anchors on the 28th–30th, and the local billing hour shifts at DST.
- **Data:**
  - Status/timestamp coherence: `canceled_at` is not tied to status.
  - `dunning_schedule_days` JSON has no CHECK.
  - `webhook_secret` is plaintext.
  - `amount_minor` is int4.
- **Contract:**
  - Handlers validate with lib schemas, not contract schemas.
  - The contract lint rule is a denylist.
  - v1 should be ILS-only but `USD` is accepted.
  - No webhook secret rotation, no `v1=` prefix, no event-id header.
- **Security** *(sec)*:
  - [env.ts:5](../../src/lib/env.ts) accepts an empty `CRON_SECRET` or `change-me`.
  - No `bodyLimit`, and no rate limit on the webhook endpoint.
  - `docker-compose.yml` binds Postgres to 0.0.0.0.
  - Confirm `MATCHA_INFRA_DEPLOY_KEY` is read-only.
- **Pre-deploy:** commit `drizzle/` (currently gitignored) before the first real database. Not urgent while there is no prod.
- **House rules:**
  - 46 repeated literals, the main group being inline effect names in [transition-table.ts](../../src/lib/subscriptions/state-machine/transition-table.ts).
  - 3 TODO comments.
  - `start-cycle-charge.ts:39-42` duplicates `findCycleParties`.

## Doc drift (specs and ADRs that contradict each other)

- **Unannotated superseded ADRs:** ADR 0007 d4 by 0010 d3; ADR 0007 d6 by 0008; ADR 0014 d1 by 0017 d5 and 0018.
- **PRD not updated:**
  - Flag on `past_due` (ADR 0005).
  - Boot guard (§5.1, Q6).
  - Q2 (anchor day) and Q3 (refunds) are decided in code but still listed open.
- **Cadence:** Spec 2, Spec 4 and the PRD say daily or nightly; the ADRs say hourly.
- **Webhook route:** `:tenantSlug` in Spec 4 vs `:providerConnectionId` in ADR 0010.
- **Idempotency transaction:** Spec 3 rule 1 says one transaction; ADR 0006 says two phases.
- **Attempt numbers:** Spec 2 says 1..N; ADR 0018 unbounds them.
- **Cron route names:** ADR 0002 says `renewal`/`dunning`; the code uses `/renew` and `/dun`.
- **Numbering:** two ADRs numbered 0015, no 0016.
- **Glossary:** `GLOSSARY.md` does not exist, though CLAUDE.md references it.

## Confirmed sound

- The intent row is committed before every provider call, and no transaction is open during `provider.charge`.
- The dedup key is derived from persisted columns, and the ISO string round-trips through Postgres exactly.
- Concurrent crons cannot double-charge: `skipLocked`, `hasLiveCharge` inside the lock, and the unique indexes.
- A timeout leaves the charge `pending`. `recordChargeResult` updates only pending rows.
- Reconcile checks amount and currency before settling.
- Every state change locks the subscription and writes its outbox rows in the same transaction. There is no lock-order cycle.
- Period math is correct: month-end clamping and Feb 29 on yearly plans.
- Outbox lease, fence, 8-attempt retry schedule and redrive match spec 5.
- Tenant isolation holds on every `/v1` route. Encryption, hashed API keys, HMAC signing with the exact signed bytes, and constant-time verification are all in place.
- Layering is clean. No `let`, no barrels, no unexplained `as`, no tenant names.

## Decisions needed from Omer

1. **What `charges.periodEnd` means** (the H1 fix):
   - Either the period the charge pays for, or the boundary that starts it.
   - Separately, add a non-unique `kind` column for settlement routing (H2). See the correction above.
2. **M7:** the spacing of catch-up charges after an outage. Spec 2 already decides that each missed period is charged.
3. **H3:** typed provider errors on the pending path, designed before slice 13.
4. **H5:** a DB trigger or `REVOKE UPDATE` on plans, plus a tool to add a new plan row (D8).
5. **M6:** compute `entitled=false` until charge #1 succeeds, which keeps Spec 1's four states.
6. **PRD Q7:** what a first-charge decline does and which event it emits.
7. **A late success on charge #1** leaves a paying customer canceled: reinstate or refund? How is a `late_success` flag cleared?
8. **A time limit on human settlement of flagged charges**, and whether cancel-at-period-end is allowed while one is open.
9. **Provider checkout-session expiry vs `checkoutTtlHours`.**
10. **Tenant API-key rotation and revocation:** there is no tool or flag today.
11. **SDK default idempotency keys:** generate per call (today), or require the caller to pass one.

## Ten highest-value missing tests

1. Activate, then renew: the period-2 charge gets a new dedup key. Use a fake that honours the dedup key.
2. Activate, then renew twice: 3 distinct keys and the period chain P1 → P2 → P3.
3. Activate on the 31st, and on a yearly plan, through the real flow; the anchor holds across renewals.
4. Activate, the renewal declines, then dunning succeeds, all through the real flow, with a late cron run.
5. Charge #1 times out, the webhook is retried, reconcile settles it with the same key, and renewal runs.
6. Unit test of the fake: a repeated dedup key returns the cached result and records no second charge.
7. Renewal and reconcile overlap on a pending charge (integration-serial).
8. Crash after the activation transaction, before `provider.charge`. Reconcile `not_found` past the grace cancels the subscription.
9. Immediate retry times out, then reconcile settles it as failed: the subscription stays `past_due` (H2).
10. Late-success flag after dunning already collected the next attempt.
