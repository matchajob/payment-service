# Roadmap to the first paying customer

Created 2026-11-22. Covers every track between today and the first paid invoice: product engineering, hosting, database, go-to-market, legal and money. It puts time on the items in `pre-release-checklist.md` (Gate 2) and `code-review-1.md`, and cites them by id instead of repeating them.

## Definition of done

An outside organization has:

1. signed our terms,
2. billed its own customers through payment-service in production, on its own terminal,
3. paid our first invoice.

A free pilot doesn't count. A design-partner discount does.

## Principles

- **Customer #1 is onboarded by hand.** No self-serve signup, no dashboard, no billing ourselves through our own product. Omer is the onboarding flow.
- **Build only for the customer in front of us.** The second adapter, invoicing adapter and any API extras wait until a real prospect needs them.
- **Freeze the contract before they write their first line.** Anything that would break their integration later ships first (Track 1, "Contract freeze").
- **Money safety is not cut.** No phase skips the real-money proof, the tested restore or the security review.

## Where we are (2026-11-22)

| Area | Done | Not done |
|---|---|---|
| Core | Lifecycle, renewal, dunning, reconcile, card update, outbox, idempotency, tenant time zones | Event and API contract gaps (H7, M17–M21, N15) |
| Providers | Grow and Stripe adapters; Cardcom checked against its sandbox API (token-only save, token charge, duplicate refusal 608) | No Cardcom adapter; no Israeli adapter tested end to end in a sandbox; port needs card expiry on `CARD_SAVED` |
| Invoicing | Port, connections, queue, drain (ADR 0027, `9b2352f`) | No adapter (Morning next) |
| Infra | Pulumi stack: Cloud Run, Cloud SQL, KMS, Scheduler, OIDC deployer, log alerts; CI; migrate job | No GCP project, so nothing deployed; no domain; restore never tested |
| GTM | Provider outreach done (Grow, Cardcom, Pelecard, Tranzila replied); market position written | Zero prospect conversations, no name/domain, no pricing, no landing page or docs |
| Legal | Licensing reasoning written (`market-position.md`) | No entity, ToS, DPA or legal opinion |

## The critical path

```
week   1    2    3    4    5    6    7    8    9   10   11   12   13   14
GTM    [name, ICP, 10 calls]-->[design partner LOI]------->[contract]-->[invoice]
ENG         [Cardcom adapter + conformance]-->[contract freeze]-->[pilot fixes]
INFRA  [GCP project]-->[staging]-->[production]-->[restore test]-->[HA tier]
PROOF                           [own terminal: real charges + clock-advanced renewals]
                                [one real monthly subscription runs in the background ...]
LEGAL  [accountant, entity]------>[lawyer: ToS, DPA, licensing opinion]-->[signed]
```

Two slow clocks set the date, and code doesn't:

1. **Sales lead time.** Discovery → design partner → signed contract usually takes 6–10 weeks. It starts this week, in parallel with code.
2. **Real renewal time.** Plans bill monthly or yearly (`BILLING_INTERVAL`), so two real renewals take two months. The proof (Track 6) speeds up the money path with an advanced clock and leaves one real monthly subscription running in the background.

**Target: first paid invoice around 2027-03-01**, with 4 weeks of slack for a slow sales cycle.

## Phases

| Phase | Weeks | Dates | Exit criteria |
|---|---|---|---|
| A. Foundations | 1–2 | Nov 23 – Dec 6 | Name and domain owned; GCP project live; 10 discovery calls booked; Cardcom adapter started |
| B. Build to the first gateway | 3–6 | Dec 7 – Jan 3 | Cardcom adapter passes the conformance suite against its sandbox; staging live; restore tested; 1–2 design partners agree in principle |
| C. Production and proof | 7–10 | Jan 4 – Jan 31 | Production live; real-money proof done on Omer's terminal; contract freeze shipped; docs and SDK public; terms drafted |
| D. Pilot to paid | 11–14 | Feb 1 – Feb 28 | Customer #1 integrated in staging, live in production, contract signed, first invoice sent and paid |

---

## Track 1: Product engineering

### Phase A–B: the first Israeli gateway

- [ ] **Cardcom adapter** (new ADR next to 0019/0020). Cardcom first because it has the best primitives for the port: a free test terminal (1000), duplicate refusal on our id (608), lookup by our id (`GetTransactionByExternalUniqTran`), and invoices built in. It also sets `idempotentCharge: true` (slice 25 capability).
- [ ] Port change: `CARD_SAVED` carries card expiry (MMYY), since Cardcom's token charge needs it. Expiry isn't card data under SAQ A, but it is still never logged.
- [ ] **Port conformance suite**: one shared test suite that every adapter must pass against the fake provider and, behind an env flag, against its sandbox. Grow, Stripe and Cardcom all run it. This is what makes provider breadth cheap later (memory: provider breadth).
- [ ] Cardcom webhook (needs a public URL, so it waits for staging in Phase B) and one real issuer decline in the sandbox.
- [ ] Second adapter **only if the pipeline asks for it**. Use the gateway that Phase A's discovery calls name most often (likely Pelecard or Tranzila). Grow stays parked (500 ILS/month from the testing stage, gated platform track).
- [ ] Invoicing: if customer #1's gateway issues invoices itself (Cardcom does), the Morning adapter waits. Otherwise build the Morning adapter with `findIssued` (ADR 0027) in Phase C.

### Phase B–C: ops correctness (Gate 1 items still required)

- [ ] M15 hot-path indexes (renewal due, expired checkouts, pending and lost charges, `idempotency_keys.completed_at`).
- [ ] M24 + M14: the settle CLI verifies ref and amount with the provider, asks for confirmation, and records the operator and reason. Redrive gets a cap.
- [ ] N3: the seed CLI stops printing the API key and stops taking credentials on argv. This is how we hand keys to customer #1, so it matters.
- [ ] N20 `bodyLimit` plus a webhook rate limit; N21; N18; N6.
- [ ] Slice 17: test tenant and smoke script, run on every deploy to staging and production.
- [ ] `/security-review` on the release branch before production.

### Phase C: contract freeze (Gate 2, before customer #1 writes code)

Changing these after they integrate costs them a migration:

- [ ] M19 `apiVersion` on the API and events; enums that accept new values.
- [ ] M20 (part): machine-readable `code` on problem+json, plus lookup by `externalRef`. Lists and pagination can follow.
- [ ] H7 charge events carry amount, attempt, reason and next retry date.
- [ ] M17, M18: distinct ordered `charge.failed` / `past_due`; events for cancel, resume and recovery; `sequence` on GET.
- [ ] M21 GET has what a billing page needs (amount, next charge date, dunning state, card last4).
- [ ] N15 webhook signature `v1=` prefix, event-id header, secret rotation.
- [ ] Slice 26 API keys with overlapping rotation (ADR, option A).
- [ ] Slice 23 SDK published under the final name.

### Phase D: pilot

- [ ] Customer #1 integrates against staging with a Cardcom test terminal connection (stand-in for slice 21 sandbox mode).
- [ ] Fix what their integration finds. Keep two weeks free for this.
- [ ] A weekly report to them (SQL run by Omer: subscriptions, failed charges, dead letters) in place of a dashboard.

### Not before customer #1

Self-serve onboarding, dashboard, sandbox mode (slice 21), Stripe and RevenueCat in production, refunds API (refunds stay manual in the gateway, documented), proration, trials, multi-currency, chaos suite beyond the ADR 0008 crash points.

---

## Track 2: Hosting service (GCP, already declared in `iac/`)

**Decision: stay on GCP.** The Pulumi stack, KMS cipher (ADR 0024), OIDC cron (ADR 0012) and deploy pipeline (ADR 0025) are already built for it. Moving would rebuild security work for no gain at this size.

- [ ] **Week 1:** GCP billing account plus two projects (staging, production), one per Pulumi stack. Set a budget alert on the billing account.
- [ ] **Region** (decision): `me-west1` (Tel Aviv). Data stays in Israel, which helps the Amendment 13 privacy story and the pitch, and it sits near the Israeli gateways. Check that Cloud Run, Cloud SQL, KMS and Scheduler are all offered there before the first `pulumi up`. The alternative is `europe-west1`: cheaper, but data leaves Israel.
- [ ] **Week 2–3:** `pulumi up` staging; set `GCP_PROJECT` on the GitHub `staging` environment (WORKPLAN 0.5); `/health` reachable; the smoke script passes.
- [ ] **Custom domain:** `api.<domain>`. Cloud Run domain mapping isn't available in every region. If `me-west1` lacks it, choose between a global external HTTPS load balancer (a fixed monthly fee) and Cloudflare in front of the `run.app` URL (free). Recommendation: Cloudflare, proxied, TLS full-strict.
- [ ] **Week 7:** production stack, Scheduler jobs for every cron and the drainer, secrets in Secret Manager, alerts to an address that pushes to Omer's phone.
- [ ] **Uptime:** a Cloud Monitoring uptime check on `/health`, plus a free-tier public status page.
- [ ] **On-call promise we can keep** (written into the terms): business-hours response, and best effort outside them. Money stays safe through an outage by design: crons catch up, charges are deduplicated and reconciled. That design is the reason a solo operator can promise this.

---

## Track 3: Database service (Cloud SQL Postgres 17)

**Decision: stay on Cloud SQL.** `iac/database.ts` already has point-in-time recovery, 14 retained backups, SSL only and deletion protection. Neon or Supabase would cost less, but they leave the GCP IAM and private-connection setup the stack relies on.

- [ ] **Staging:** `db-f1-micro`, zonal (the current default). Fine.
- [ ] **Production tier** (decision, two defensible shapes):
  - **A. Dedicated core, regional** (`db-custom-1-3840`, `REGIONAL` as `iac/database.ts` declares today). Covered by the Cloud SQL SLA, with automatic failover. Costs the most of the two.
  - **B. Shared core, zonal** (`db-g1-small`). About a quarter of A's cost. Not covered by the SLA, and recovery is restore-from-backup (minutes to hours, API down meanwhile; money still safe).
  - **Recommendation:** B during the proof phase on Omer's own terminal, and A from the day customer #1's real customers are billed. This needs one Pulumi change: production availability becomes a stack setting.
- [ ] **Tested restore** (runbook `docs/runbooks/restore.md` exists and has never been run): once in staging in Phase B, once in production before go-live. Time it and write the number into the runbook.
- [ ] Check the pool size against the tier's connection limit times Cloud Run's max instances. Shared-core tiers have low limits.
- [ ] **Data and privacy:** write down a retention period for `webhook_events.rawBody` and customer billing details. The DPA (Track 5) cites it.

### Rough monthly running cost at one customer

| Item | Proof phase | After go-live |
|---|---|---|
| Cloud SQL production | shape B, small | shape A, the largest line |
| Cloud SQL staging | small | small |
| Cloud Run, Scheduler, KMS, Secret Manager, Artifact Registry | near zero at this volume | near zero |
| Domain, Cloudflare, status page | domain only | domain only |
| Omer's own Cardcom terminal (proof) | ask Cardcom | cancel after proof |

These are deliberately not numbers. Price both shapes in the GCP calculator for the chosen region in week 1, and record them here.

---

## Track 4: Go-to-market and marketing

### Positioning (from `market-position.md`)

> Stripe Billing's behaviour on the Israeli gateway you already have.

What we're replacing is the prospect's own build on a gateway, and the gateway's basic standing order. Stripe isn't the main competitor.

### Ideal first customer

An Israeli company that bills card subscriptions in ILS, already has a Cardcom terminal (or the gateway our second adapter will cover), has a developer, and is currently building or maintaining recurring billing itself. Marketplaces, B2B SaaS for local businesses, and content or education apps fit v1's scope (one plan per tenant, ILS, no proration).

### Pricing (decision)

Flat monthly fee per organization, never a percentage of volume (strategy §2). Test the number in every discovery call against what the prospect pays now: the gateway's standing-order module, developer time spent on billing, and churn from failed charges. Customer #1 gets a design-partner price locked for 12 months, in exchange for feedback, a logo and a case study.

### Channels, in order of how fast they can produce customer #1

1. **Warm network.** Omer's developer and founder contacts. Ask each one: "who do you know who bills subscriptions in Israel?" Fastest channel. Start week 1.
2. **Software agencies (בתי תוכנה).** One agency builds for many merchants and rebuilds billing every time. Each of its clients becomes its own organization (ADR 0010).
3. **Gateway partner programmes.** Cardcom's and Pelecard's software-house programmes refer merchants who ask for recurring billing. Join once we can show a working integration (Phase C). Never mention MatchaJob or job-platform to providers.
4. **Communities.** Israeli developer and founder groups, LinkedIn build-in-public posts in Hebrew about the gateway quirks we absorb (unsigned webhooks, timeouts, duplicate charges).
5. **Hebrew SEO** ("סליקה חוזרת API", "הוראת קבע באשראי", "חיוב חוזר נכשל"). Slow. Start content in Phase C, but don't count on it for customer #1.

### Funnel to plan for

40 contacted → 12 discovery calls → 3 design-partner candidates → 1 signed. Track it in a "Pipeline" list in the ClickUp folder "payment-service: go-to-market", next to Actions, Providers and Decisions.

### Marketing assets, by phase

- [ ] **A:** name and domain (blocks the landing page, docs, SDK name and email); a one-page Hebrew pitch; a discovery-call script (what they bill with, what it costs, what breaks, who maintains it).
- [ ] **B:** landing page (Hebrew first, English second) with a waitlist or "book a call"; a comparison page "vs building on your gateway's standing order".
- [ ] **C:** public docs (quickstart, routes, events, receiver example, errors); a 2-minute demo video (create subscription → hosted checkout → renewal → signed webhook → failed charge → dunning → recovery); a savings calculator.
- [ ] **D:** case study draft with customer #1.

### Weekly cadence (from week 1)

10 new outreach messages, 3 calls, 1 LinkedIn post, pipeline updated in ClickUp every Friday.

---

## Track 5: Legal, company and money

- [ ] **A: accountant.** Entity type (decision): עוסק מורשה is fastest to invoice; בע"מ limits personal liability, which matters for a billing service. Recommendation: ask the accountant and lean בע"מ before the contract is signed. Open a business bank account.
- [ ] **A: invoicing ourselves.** A Morning account to issue our own tax invoices to customer #1. It also gives hands-on access to the API the Morning adapter will use.
- [ ] **B–C: lawyer** (budget needed; get two quotes in Phase A):
  - Licensing opinion: bring-your-own-account keeps us outside payment-services licensing (`market-position.md` gives the reasoning; the lawyer confirms it).
  - Terms of service / MSA: SLA matching Track 2's on-call promise, liability cap, and refunds and post-cancel downgrade stated as the client's job.
  - DPA and privacy policy under Amendment 13: we process every tenant's customer PII.
- [ ] **C:** PCI SAQ A self-assessment with the real Cardcom hosted page (core product rules: no card data, ever).
- [ ] **D:** signed contract, first invoice, payment received.

---

## Track 6: Real-money proof (replaces Gate 1's dogfood)

Omer opens his own small Cardcom terminal. It's used only for the proof and never for a client's money (decided 2026-11-17).

- [ ] Production live (Track 2) plus the Cardcom adapter (Track 1). Ask Cardcom what the terminal costs per month during Phase A.
- [ ] A real card, a real small first charge, refunded by hand in Cardcom.
- [ ] **Speed-up** (decision): an operator command that runs renewal, dunning and reconcile for **one** subscription of the test tenant with an advanced `now`. The crons already take `now`, which is why this is cheap. It proves renewal, a real decline, dunning and recovery against the real gateway in days instead of months. Only allowed for the test tenant.
- [ ] One real monthly subscription left running from Phase C onward, so the scheduler is also proven in real time. Its first real renewal lands around go-live.
- [ ] Every charge row reconciled against Cardcom's report. Any mismatch blocks go-live.

---

## Decisions needed from Omer

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| 1 | Name and domain | Pick in week 1; check the domain and the npm scope together | Week 1 |
| 2 | Hosting region | `me-west1`, if every service is there | Week 1 |
| 3 | First adapter | Cardcom | Week 1 |
| 4 | Production DB shape | B for the proof, A at go-live | Week 7 |
| 5 | Entity type | בע"מ, confirmed with the accountant | Week 2 |
| 6 | Pricing number | Test in calls; locked design-partner price | Week 6 |
| 7 | Clock-advance proof command | Yes, test tenant only | Week 5 |
| 8 | Legal budget | Two quotes in Phase A | Week 2 |

## Risks

| Risk | Effect | Mitigation |
|---|---|---|
| No prospect is on Cardcom | The adapter doesn't help customer #1 | Ask "which gateway?" in the first calls; the conformance suite makes the second adapter a week, not a month |
| Sales cycle runs past 10 weeks | Date slips | Warm network first; design-partner price; 4 weeks of slack |
| Customer #1 needs invoices and its gateway can't issue them | Morning adapter becomes urgent | Ask in discovery; build in Phase C |
| Solo operator outage | Lost trust | Money-safe design, phone alerts, honest SLA |
| Legal cost with no budget | Contract can't be signed | Quotes early; the free licensing evidence is already gathered |
| Contract change after integration | Customer #1 pays a migration | Contract freeze in Phase C, before they start |

## After customer #1

Refresh `pre-release-checklist.md` (Gate 1 as written no longer applies), revisit the reconcile windows (memory note), then: second adapter, sandbox mode (slice 21), the Pelecard terminal-referral partnership (v2), and a minimal dashboard.
