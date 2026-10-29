# Pre-release checklist

Created 2026-10-19. This file is the release view of work that is tracked elsewhere. Each item names its source: a slice in `WORKPLAN.md`, a finding id in `docs/review/code-review-1.md`, or a section of `docs/product/hosted-service-strategy.md`. Check an item here only when its source is checked.

There are three gates, in order. Each gate assumes the one before it is closed.

- **Gate 0: de-risk.** Cheap checks that could change the plan. Do them first, while the code is still easy to change.
- **Gate 1: dogfood.** job-platform charges real customers through a production deploy. Our money and our customers carry the risk.
- **Gate 2: first outside client.** Another organization's merchant account and customers. From here on, the API, the events and the SDK are a contract we can't break.

## Gate 0: De-risk (this week)

- [ ] Apply to Grow's platform partner track and get its terms in writing. Grow documents a "Platforms & System Integrators" setup: approval required, a platform `apiKey`, routing identifiers issued by Grow, an embeddable merchant registration form, and `companyCommission` under a commercial agreement. Still open: whether a merchant's existing Grow account can be linked, what authorization the merchant gives us, and whether token charges are allowed under the platform key. *(strategy §5, §6 Legal; email sent 2026-10-19 to support@grow.business, awaiting reply)*
- [ ] **Decide the v1 provider.** job-platform has no merchant account yet (2026-10-20), so v1 is open. Grow: adapter built (`9267c88`), but API access is 500 ILS + VAT a month from testing, and a gated platform track. Cardcom: best fit for the port (duplicate refusal and lookup on our id), a shared free test terminal, invoices built in; pricing unknown, no adapter. Compare the full monthly cost for job-platform's own account (terminal, API, modules, per-transaction rate) once Grow and Cardcom answer. Switching v1 is a new adapter plus ADR 0019 amended, not a rewrite. *(landscape doc)*
- [ ] Grow sandbox credentials: a sandbox `userId` and `pageCode` **with token permission** (`chargeType=3` save plus server-side `createTransactionWithToken`). Asked as Q8 in the 2026-10-19 email; when Grow replies, confirm token permission explicitly. Slice 13 code is committed (`9267c88`, 789 tests green, per the slice-13 session) and waits only on this. The reply to Grow also asks the open adapter questions (payer name and phone collected by the page, `cardToken` in `getPaymentProcessInfo`, lookup of an unused id, `err.id` for a duplicate `transactionUniqueIdentifier`). *(slice 13, ADR 0019)*
- [ ] Sandbox: Grow's token-only checkout saves a card with no charge, and a token charge right after it succeeds without 3DS. If either fails, the save-then-charge fallback (PRD Q6) and refunds become v1 work. *(slice 13, ADR 0007)*
- [ ] Sandbox: every **[?]** in `.claude/skills/grow/SKILL.md` answered, with the bodies recorded in `wire-examples.md`. *(slice 13)*
- [ ] Outreach to the other Israeli gateways (Cardcom, Hyp, PayPlus, Tranzila, Pelecard), in parallel with Grow, so a second adapter and a fallback exist if Grow's terms don't work. Comparison and contacts in `docs/product/israeli-provider-landscape.md`. *(emails sent 2026-10-19, awaiting replies)*
- [x] Find out what Grow's own recurring billing does, so the pitch says what we add on top of it. *(strategy §3; answer in `docs/product/israeli-provider-landscape.md`, "Grow's own recurring billing")*
- [ ] Find out whether Grow issues the tax invoice for each charge, or whether we need Morning, iCount or Sumit. Israeli law requires an invoice for each payment, so this blocks Gate 1 too. *(strategy §6 Platform)*
- [ ] Governance: the working tree deletes `.claude/hooks/protect-src.sh` and `.claude/settings.json`. Deleted on purpose (Omer, 2026-10-19). Left: Omer updates the CLAUDE.md line "A hook enforces this" and closes N23 in code review 1. *(N23)*

## Gate 1: Dogfood (job-platform on real money)

### Money correctness (anything that charges wrongly or grants unpaid access)

- [ ] H1: subscriptions renew after charge #1. *(in progress: `kind` and `nextPeriodEnd`; step 11, `settle-reconciled-charge`, is still open)*
- [ ] H2: a timed-out card-update retry doesn't cancel the customer.
- [ ] H4: failing rows can't starve renewal, dunning and reconcile, and `find-unsettled-charges` has an upper age bound.
- [ ] M6: no unbounded `entitled: true` while charge #1 is pending or flagged.
- [ ] M9: a `late_success` flag can be cleared, so a late-succeeded charge #1 doesn't leave a payer canceled.
- [ ] H3: `ChargeResult` has an error branch, so a credential failure can't turn into mass declines. *(slice 13 gate)*
- [ ] H5: the database refuses to reprice a plan (a trigger or `REVOKE UPDATE`), and the seed CLI can add a plan so nobody types `UPDATE plans`. *(H5, N2)*
- [ ] M2: the idempotency hash covers the route and the tenant as well as the body.
- [ ] M1, M25: webhooks. `NOT_COMPLETED` isn't marked processed, and a garbage body returns 200, not 500.
- [ ] N1: an expired checkout can't save a card later from a stale tab.
- [ ] M13: tenant integrity enforced by composite foreign keys.
- [ ] Decide N12, billing in UTC or in Israel time, **before the first real activation**. Once anchors are stored, changing it moves every customer's billing date.

### Provider

- [ ] Grow adapter built and reviewed. *(slice 13)*
- [ ] Grow's production review passed. Grow reads the sandbox logs (correct requests, `notifyUrl` answered with 200, `approveTransaction` where required, field validation) before it issues live `pageCode`, `userId` and `apiKey`. It takes several business days. Request it from support@grow.business. *(developers.grow.business/reference/live-environment)*
- [ ] Signed commercial agreement with Grow. Grow requires one before a platform or partner integration goes live.
- [ ] Provider overload: refused vs ambiguous failures, no dunning attempt used up by an outage, a circuit breaker per connection. Grow has no idempotency, so this is about money, not performance. *(slice 25)*
- [ ] A timeout on every provider call. *(M11, M4)*

### Security

- [ ] KMS credential cipher, with the sealed blob bound to its `providerConnectionId` as associated data and a key id for rotation. *(slice 20, N5, H6)*
- [ ] Cron auth decided and provisioned: OIDC or `CRON_SECRET`, not half of each. An empty or `change-me` secret is refused at boot. *(H6, N19)*
- [ ] The seed CLI doesn't print the API key to stdout or take credentials on argv. *(N3)*
- [ ] `bodyLimit` on every route, and a rate limit on the webhook route. *(N20)*
- [ ] Postgres not bound to `0.0.0.0`, and the infra deploy key confirmed read-only. *(N21)*
- [ ] Run `/security-review` on the branch that goes to production.

### Deploy and operations

- [ ] Application CI: typecheck, lint and tests on every push. *(N4, slice 0.5)*
- [ ] Dockerfile, Cloud Run, the 0.6 review fixes, Scheduler jobs for every cron and the drainer. *(slices 0.5, 0.6, 16)*
- [ ] Migrations committed and reviewed, not generated in CI. *(N22, slice 0.2)*
- [ ] Hot-path indexes: renewal due, expired checkouts, pending and lost charges, `idempotency_keys.completed_at`. *(M15)*
- [ ] Cron endpoints return non-200 on failure and have a time budget. *(M11)*
- [ ] SIGTERM drains requests and closes the pool. *(M22)*
- [ ] Dead letters, ignored webhooks and ignored card updates are logged loudly. *(M23)*
- [ ] An alert on each of these: a dead letter, a flagged charge (`stuck_pending`, `ref_not_found`, `amount_mismatch`, `late_success`), a cron that failed or didn't run.
- [ ] Database backups, and **one tested restore**.
- [ ] Settle CLI checks the ref and the amount against the provider, asks for confirmation, records operator and reason. Redrive has a cap. *(M24, M14)*
- [ ] Runbooks: redrive, settling a flagged charge, Grow outage, rotating a credential, a manual refund in Grow.

### Tests (Claude)

- [ ] The fake provider honours `dedupKey`, and `verifyCharge` sees earlier charges. *(M28)*
- [ ] Seeders build only states the real flow produces. *(M27)*
- [ ] Stronger assertions in the cron, reconcile-concurrency and safety tests. *(M29)*
- [ ] The "ten highest-value missing tests" in code review 1.
- [ ] Chaos: the ADR 0008 crash points and the invariant checks. *(slice 18, at least the crash points)*

### Go live on our own tenant

- [ ] The job-platform receiver verifies, dedups and mirrors by sequence; the entitlement product decision is recorded. *(slice 15)*
- [ ] Test tenant and a smoke script in staging. *(slice 17)*
- [ ] One real card, a real small charge in production, refunded by hand in Grow.
- [ ] **Two real renewal cycles and at least one real dunning recovery** observed in production, with every charge row reconciled against Grow's report. A monthly plan makes this about two months, so start Gate 1 early.

## Gate 2: First outside client

### Contract freeze (breaking changes cost a migration for every tenant after this)

- [ ] `apiVersion` on the API and the events, and enums that tolerate new values. *(M19)*
- [ ] Machine-readable `code` on problem+json. *(M20)*
- [ ] Charge events carry amount, attempt, reason and next retry date. *(H7)*
- [ ] `charge.failed` and `past_due` are distinct, ordered deliveries; cancel, resume and recovery emit events; GET returns `sequence`. *(M17, M18)*
- [ ] GET has what a billing page needs: amount, next charge date, dunning state, card last4. *(M21)*
- [ ] Lookup by `externalRef`, list endpoints and pagination. *(M20)*
- [ ] Webhook signature `v1=` prefix, event-id header, and a way to rotate the secret. *(N15)*
- [ ] API keys with overlapping rotation. *(slice 26)*
- [ ] SDK published under its final name. *(slice 23)*

### Product scope we tell the client up front

- [ ] Refunds: a manual process in Grow, written down, or a refund flow. *(PRD Q3)*
- [ ] The post-cancel downgrade is the tenant's job, and the docs say so. *(PRD Q5)*
- [ ] One plan per tenant, ILS only, no proration or trials, hard declines run full dunning. Written in the docs, not discovered by the client. *(strategy §6 Scope)*

### Onboarding and support

- [ ] Onboarding runbook: organization, connection, application, plan, API key and webhook secret handed over securely. *(slice 16)*
- [ ] A way for the client to integrate without real money: a sandbox connection, or the test tenant with test clocks. *(slices 17, 21)*
- [ ] Public docs: quickstart, every route, every event, receiver example, errors.
- [ ] A minimal view of their subscriptions, failed charges and dead letters, even if it's a read-only page we run for them at first. *(strategy §6 Platform)*
- [ ] Status page, uptime monitoring, and an on-call promise we can keep.

### Legal and commercial

- [ ] Licensing: confirm that the bring-your-own-account model keeps us outside payment services licensing. Moved from Gate 0 (2026-10-19, no budget yet). Free evidence first: Grow's platform track and Cardcom's multi-merchant FAQ both treat a platform as a technical integrator with money going straight to the merchant; ask each provider's sales team in writing whether their platform partners need a licence. A paid legal opinion before the first outside contract is signed. *(strategy §6 Legal)*
- [ ] Company entity and bank account.
- [ ] Terms of service with an SLA and a liability cap.
- [ ] Data processing agreement and privacy posture under Amendment 13. *(strategy §6 Legal)*
- [ ] PCI scope confirmed as SAQ A with the real Grow integration.
- [ ] Pricing, and how we bill the client (probably ourselves, as tenant zero).
- [ ] Name and domain settled.

## Not needed before the first client

Self-serve onboarding, a second Israeli acquirer, Stripe, RevenueCat, local webhook forwarding, the full dashboard. These matter for the tenth client, not the first. The first one is onboarded by hand.
