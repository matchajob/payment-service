# Stripe features on a basic Israeli gateway

Research of 2026-10-21. For each Stripe feature: can a software-only billing layer offer it on top of a Pelecard, Cardcom or Tranzila style gateway (hosted page returning a token, token charge, refund, lookup, unsigned callbacks)? Feasibility classes and effort are engineering judgement, not sourced facts. **[C]** confirmed on a source page, **[3P]** third party, **[?]** unverified.

Classes: **Software** (we build it), **Gateway** (needs the gateway to expose it), **Network** (needs card-network or acquirer programmes), **Licence** (needs money handling; out of scope).

## Catalogue

| Feature | Class | How we'd offer it | Effort |
|---|---|---|---|
| Products, prices, plans | Software | Catalogue tables, versioned price per plan | S |
| Tiered, volume, per-seat pricing | Software | Pure amount functions of quantity | M |
| Metered usage | Software | Usage-event table summed at period close | M–L |
| Trials | Software; a trial with a saved card needs Gateway (save without charge) | J2 where offered; else a small authorisation, or a trial without a card | S |
| Proration | Software | Day-based credit and debit lines; partial refund for a mid-cycle downgrade | M |
| Coupons, promotion codes | Software | Discount rules with redemption limits | M |
| Subscription schedules (phases) | Software | Phase table read by renewal | M |
| Pausing | Software | Status that skips renewal | S |
| Cancel at period end | Software | Already built (slice 9) | done |
| Quotes | Software | Quote that becomes a subscription on acceptance | M |
| One-off invoice items | Software | Pending lines swept into the next invoice | S |
| Invoices and PDFs | Software, plus Israeli law | Use a licensed invoicing service (Payper, Cardcom documents, Morning). Tax invoices above 5,000 ILS need a Tax Authority allocation number since 2026-06-01 [3P] | L |
| Credit notes | Software (+ gateway refund) | Credit document plus refund or balance credit | M |
| Customer balance, credits | Software | Per-customer ledger applied before charging | M |
| Multi-currency | Gateway | Only where the terminal settles in that currency | M |
| Smart Retries | Network for the ML half | Decline-code heuristics: stop on hard declines, retry soft ones at better times, cap attempts | M |
| Dunning emails | Software | Templated email per attempt | S |
| **Card account updater** | Network | **Israel has one through the gateways:** Pelecard's Muhlafim reports replaced, expired, blocked and cancelled cards from the card companies after each transmission and updates the token itself [C, Pelecard docs]. Ask Cardcom, Tranzila and Hyp for theirs. Plus a pre-expiry "update your card" email | S per gateway |
| Network tokens (card-on-file) | Network | Ask each gateway. Network tokens exist in Israel for wallets (Apple Pay since 2021) [3P]; no evidence yet for card-on-file [?] | n/a |
| Adaptive Acceptance | Network | Partial: don't retry codes that can't succeed | S |
| Customer portal | Software | Self-serve pages: change plan, cancel, invoices, update card via the hosted page | M |
| Hosted invoice page | Software | Signed link with a Pay button opening the hosted page | M |
| Payment-method update links | Software | Already built (slice 11) | done |
| Checkout | Gateway already has it | Wrap the hosted page | done |
| Payment Links | Software | Shareable URL creating a checkout | S |
| Elements | Gateway | Use the hosted page; keeps us out of card-data PCI scope | n/a |
| Link (one-click wallet) | Licence (Stripe's own network) | None | n/a |
| Apple Pay, Google Pay, Bit | Gateway | Pass through where the gateway offers them (Pelecard does [C]) | S |
| 3DS/SCA | Gateway | Pass through | S |
| Radar fraud | Network for network signals | Velocity, BIN country, IP rules; low priority for subscriptions | M |
| Disputes, chargebacks | Gateway (dispute feed) | Record from a gateway report; flag the subscription | M |
| Refunds | Gateway already has it | Wrap with a ledger entry | S |
| Idempotency keys | Our API: Software (done, slice 2). Provider side: Gateway | Our dedup key plus lookup before retry (reconcile, ADR 0017); `idempotentCharge` where the gateway has it (Cardcom) | done / M |
| Signed webhooks, event replay | Ours: Software (done, slices 6 and 23). Inbound: Gateway | Callbacks are hints confirmed by lookup | done |
| Test mode, test clocks | Software | Injectable clock exists; sandbox mode is slice 21 | M |
| Tax | Software for Israel | Israel isn't on Stripe Tax's list [C]; a VAT rate table suffices domestically | S |
| Revenue recognition | Software | Deferred-revenue schedule from invoice periods | L |
| Reporting (Sigma), exports | Software | SQL on a read replica; CSV export | S |
| Connect, split payments, payouts, Treasury, Capital, merchant of record | Licence | Out of scope; the acquirer settles to the merchant | n/a |

## Reading

- Almost all of Stripe Billing is **Software**: catalogue, pricing models, proration, coupons, schedules, portal, invoices, recovery emails. That is the product.
- The features that truly need network access are the card updater, network tokens, Adaptive Acceptance, and the cross-merchant data behind Smart Retries and Radar. Even Stripe gets the updater only where issuers take part [C].
- Israel's card updater lives at the gateway, not the network: Pelecard's Muhlafim. So "automatic card updates" is a capability per provider, not a Stripe-only feature.
- Stripe doesn't serve Israel as a supported country [C].

## Pricing reference [C]

Stripe Billing: 0.7% of billing volume pay-as-you-go; annual plans from $620/month (up to $100k volume) to $5,750/month (up to $1M), 0.67% above. Smart Retries and recovery automations included. Card processing on top (2.9% + 30¢). Invoicing alone: 0.4% per paid invoice. Tax: 0.5% per transaction. So the market price of a billing layer is about 0.5–0.8% of billed volume, on top of processing.

## Sources

- stripe.com/billing/pricing, stripe.com/pricing, stripe.com/global
- docs.stripe.com: billing/revenue-recovery/smart-retries, payments/cards/overview, payments/analytics/optimization, api/idempotent_requests, webhooks, billing/testing/test-clocks, tax/supported-countries
- developer.visa.com/capabilities/vau; developer.mastercard.com/automatic-billing-updater
- en.globes.co.il/en/article-1001381078; appleinsider.com/articles/21/05/05/apple-pay-launches-in-israel
- docs.base44.com (Tranzila setup)
- beancount.io/blog/2026/09/22/israel-invoice-allocation-number-5000-nis-osek-murshe-b2b-guide; sovos.com (Israel invoice allocation number)
- docs.pelecard.com/documentation/muhlafim-programmer-guide (card updater)
