# Hosted service strategy

**Status:** Working draft, 2026-10-15. From a conversation between Omer and Claude. Market figures and competitor facts are from memory, not research. Every one of them is listed under "Claims to verify" and should be checked before it's used in a pitch.

## 1. What we're selling

A hosted subscription-billing service. Businesses sign up as organizations, connect their own payment provider account, and integrate one or more applications through our API. We run the lifecycle, charging, retries and events. We never hold their money and we don't sell the code.

Job-platform is the first tenant and the first design partner.

## 2. The wedge

> **Stripe-quality developer experience, on whichever provider is cheapest for you. Connect it once, and use it from all your apps.**

Two parts:

1. **Good DX on a cheap provider.** Stripe's DX is the benchmark, but on billed revenue it charges processing plus a separate Billing fee, roughly 0.7% of volume. A local Israeli acquirer with a negotiated domestic rate can be well below Stripe's total. The trade-off today is poor DX: unsigned webhooks, no idempotency, unclear outcomes on timeout, and inconsistent decline formats. We absorb those quirks so the tenant never sees them.
2. **One provider connection, many apps.** One merchant account means one onboarding and one terminal fee, shared by every application of the same legal entity. See ADR 0010 for the boundary.

### What we already have that is the DX

| Provider weakness | What the tenant gets instead | Where |
|---|---|---|
| Unsigned webhooks | We verify with the provider, then send HMAC-signed events | Slice 5, `spec/outbox-delivery.md` r5 |
| No idempotency | Two-phase idempotency keys on every mutation | ADR 0006 |
| Timeout with an unclear outcome | A pending charge row, reconcile, never a double charge | ADR 0008, slice 12 |
| Inconsistent decline reasons | One `declineReason` shape | Slice 5 |
| Unreliable notification delivery | Outbox with lease, retries and dead letter | ADR 0009 |
| No entitlement model | `entitled` computed by us, plus full snapshots in every event | D4, PRD 1.3 |

### Pricing principle

**A flat monthly fee per organization, never a percentage of volume.** "We never take a cut of your revenue" is the headline, and it follows from the wedge. If we charge a percentage, we're Stripe with extra steps.

## 3. Competitors

| Category | Players | How they compare |
|---|---|---|
| All-in-one processor plus billing | **Stripe Billing**, Adyen, Braintree | The benchmark. They win wherever the customer can use them and doesn't mind the percentage. |
| Billing layer on top of gateways | Chargebee, Recurly, Maxio, Zuora | The same shape as us. As far as we know, they don't treat Israeli acquirers as first-class gateways. |
| Payment orchestration | Spreedly, Primer, Gr4vy, Juspay/Hyperswitch (open source) | Route payments across providers, but are weak on subscription lifecycle. Stripe is also moving here with orchestration to other processors. |
| Merchant of record | Paddle, Lemon Squeezy (Stripe-owned), FastSpring | Easy for Israeli software sellers and they handle global tax. A strong pull for SaaS selling abroad. |
| App-store subscriptions | RevenueCat, Adapty, Qonversion | Own mobile, weak on local card acquiring. Our v2 unifies both. |
| Local Israeli bundles | Grow's own recurring payments, Sumit, Morning (Green Invoice), iCount, Cardcom, Tranzila, PayPlus | The real local competition. Basic recurring charges, but they **bundle tax invoices**. Weak dunning, webhooks and entitlement. |

### Is Stripe a competitor?

Yes, as the benchmark and wherever it's available. Two things shrink its reach in our market:
- As far as we know, Stripe doesn't onboard Israeli-registered businesses directly. Israeli companies use a foreign entity, for example through Stripe Atlas. **Verify this.**
- Even with Stripe access, some merchants want local acquiring for domestic fees, installments (תשלומים) and local cards.

Positioning line: *Stripe Billing's behaviour, for merchants who can't or won't pay Stripe's rates.*

## 4. Who we sell to

The ideal customer charges card subscriptions in ILS, finds Stripe unavailable or expensive, and has a developer to integrate an API.

1. **Israeli B2C apps with subscriptions** (fitness, dating, education, content). They need card and App Store billing under one state machine, which is the v2 story.
2. **Marketplaces and platforms like job-platform** (job boards, B2B directories, SaaS for local businesses). They fit v1 scope exactly.
3. **Software agencies (בתי תוכנה).** Likely the best channel: one agency builds for many clients and keeps rebuilding subscription code. Under ADR 0010, each client is its own organization with its own merchant account, so the agency brings us tenants but can't share one account across clients.
4. **Membership businesses** (gyms, courses, clinics). Not now. They need a no-code layer we don't have.

The sales argument is the prospect's own numbers: their monthly volume times the difference between Stripe's total rate and their local rate, compared with our flat fee.

## 5. Risks

1. **Tax invoices.** Israeli buyers expect every charge to produce a חשבונית מס with an allocation number where required. Without that, "Sumit plus Grow's recurring feature" is good enough for most small businesses.
2. **A small market.** Businesses that integrate APIs are exactly the ones who build billing themselves, or move to Stripe or Paddle through a foreign entity. Validate this before investing in v2.
3. **Stripe negotiates.** Mid-size companies can get custom Stripe pricing, which shrinks the savings argument at the top of the market.
4. **Running it.** Selling billing means running billing: uptime, incident response and provider disputes, for a solo operator.
5. **Regulation** if the model drifts toward money flowing through our account. ADR 0010 keeps us out of it by design.
6. **Statement descriptors.** Several apps on one merchant account show one name on the card statement, which causes "I don't recognize this" chargebacks.

## 6. Gaps

### Product scope (v1 is thin next to Chargebee or Stripe)

- [ ] One plan per tenant. No upgrades, downgrades, proration or trials (PRD 1.2, 1.3).
- [ ] ILS only.
- [ ] No refunds (PRD open question 3).
- [ ] Hard declines run the full dunning schedule.
- [ ] Post-cancel downgrade is undefined for tenants (PRD open question 5).

### Hosted-service platform

- [ ] **Organizations and provider connections** with encrypted credentials per connection (ADR 0010, slice 19). Today there is one global provider instance.
- [ ] **Tax invoice integration** per successful charge, through Morning, iCount or Sumit, chosen per organization.
- [ ] **Self-serve onboarding.** Today a tenant is created with the seed CLI.
- [ ] **A minimal dashboard:** subscriptions, failed charges, dead-letter events with a redrive button. Tenants' support teams need it on day one.
- [ ] **Alerting on dead letters.** Out of scope today (D13).
- [ ] **Billing ourselves:** how organizations pay our flat fee. Probably our own service, as tenant zero.

### Developer experience

- [ ] Test mode per application with a sandbox connection (slice 17 is part of it).
- [ ] A typed SDK generated from `src/contract`.
- [ ] Local webhook forwarding, like `stripe listen`.
- [ ] Public docs with copy-paste examples, a changelog and API versioning.

### Providers

- [ ] Grow adapter (slice 13).
- [ ] At least one second Israeli acquirer (Cardcom, Tranzila or PayPlus). Until then, "use whichever provider" is a promise, not a feature.
- [ ] A fallback for providers without card-save-without-charge (PRD open question 6). It needs refunds.
- [ ] RevenueCat (v2, slice 14).

### Legal and compliance

- [ ] A lawyer's confirmation that the bring-your-own-account model keeps us outside payment services licensing.
- [ ] Decide whether an organization's legal entity is verified technically or by contract (ADR 0010, open).
- [ ] A data processing agreement, and a privacy posture under Privacy Protection Law Amendment 13 (in force since August 2025). We hold every tenant's customer PII.
- [ ] PCI scope check. Hosted checkout and tokens should keep us at the lightest level (SAQ A). Confirm with the Grow integration.
- [ ] Terms of service, including an SLA.

### Operations

- [ ] Production deploy, Pulumi, CI (slices 0.5, 0.6, 16).
- [ ] Status page, uptime monitoring, on-call plan, backups with a tested restore.
- [ ] Runbooks: onboarding, redrive, provider outage, credential rotation.

## 7. Claims to verify

- Stripe Billing's current pay-as-you-go percentage, and Stripe's processing rate on Israeli and foreign cards.
- Whether Stripe onboards Israeli-registered businesses today.
- Typical Grow, Cardcom, Tranzila and PayPlus rates and monthly terminal fees at small and mid volume.
- Whether Chargebee or Recurly support any Israeli acquirer.
- How far Stripe's orchestration to other processors has gone.
- Whether Grow sets the notify URL per transaction or per account, and whether it supports a statement descriptor per transaction (slice 13).
- Current Israeli tax-invoice allocation-number thresholds.

## 8. Next steps

1. Decide ADR 0010 and do slice 19 before slice 8.
2. Talk to about 10 prospects (founders of Israeli apps and SaaS products, plus 2–3 software agencies). Ask what they bill with, what it costs them, and what hurts. Get 2–3 design partners, cheap or free in exchange for feedback, with job-platform counting as one.
3. Answer section 7 before quoting a number to anyone.
