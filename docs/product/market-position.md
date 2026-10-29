# Where payment-service fits

Synthesis of 2026-10-21, from the call with Pelecard and four research reports: `.claude/skills/pelecard/SKILL.md`, `israeli-payments-stack.md`, `chargebee-case-study.md`, `stripe-feature-feasibility.md`. Plus the provider replies in `israeli-provider-landscape.md`.

## The corrected picture

We had treated every company we emailed as the same kind of "provider". They are three different kinds:

| Kind | Who | Merchant's clearing agreement is with | Paid by |
|---|---|---|---|
| **Gateway** | Pelecard, Hyp, PayPlus | Isracard, Max or Cal | Monthly fee to the gateway; clearing % to the card company |
| **Licensed acquirer that also runs a gateway** | Cardcom, Tranzila | Cardcom or Tranzila itself, or a card company | Clearing % (and gateway fees) |
| **Licensed payment service provider** | Grow | Grow | % per transaction; Grow's API costs 500 ILS a month |

None of them is what we build. We are the fourth kind, the one Chargebee is abroad:

| **Billing software on top** | payment-service | Unchanged: with whichever of the above the merchant uses | Our fee |

## What each kind already does about recurring billing

- **Gateways** keep tokens, charge them on request, and some run a basic standing order on a fixed day. Pelecard's PeleBilling has no retry policy, no webhooks, results by polling. Its Muhlafim card updater is the one network-level feature a software layer can't build, and it lives in the gateway.
- **Grow** retries a failed charge up to 10 days, never past month-end.
- **None** offers plan changes, proration, coupons, dunning on the merchant's schedule, entitlement, signed sequenced events, idempotent API, reconcile, or a customer portal. In Stripe's terms, almost all of Stripe Billing is missing, and almost all of it is software we can build (`stripe-feature-feasibility.md`).

## Why not become a gateway

Working "directly with the card companies" the way Pelecard does means Shva certification, EMV, PCI DSS Level 1 with an annual on-site audit, and holding card data. It's a different company, and the market already has a dozen. It doesn't add what merchants lack, which is the billing layer.

## Why we need no licence and no permission

- **Licence.** Under the 2023 law the ISA's test is direct participation in moving funds. We never move funds and never see card data. No requirement was found for software that only calls a gateway (`israeli-payments-stack.md`). ADR 0010's line holds: never let money pass through us.
- **Permission.** Chargebee started on public gateway APIs with each merchant's own credentials and needed no agreements; partnerships came later with volume (`chargebee-case-study.md`). In Israel, Pelecard, Cardcom, Tranzila, PayPlus and Hyp all let a merchant's own credentials suffice. Grow, a licensed provider with a gated platform track, is the exception.
- **Card companies, Visa, Mastercard.** Not needed. Acceptance always goes through a licensed acquirer and Shva; the schemes' partner programmes certify products and grant no access. Isracard and Max have no public technology-partner programme; Cal's portal is for issuing.

## What we sell

"Stripe Billing's behaviour on the Israeli gateway you already have." The merchant keeps its clearing agreement and its gateway; we add the lifecycle on top. Our competitor is the merchant's own build on a gateway, and the gateways' basic standing orders.

Price reference: Stripe Billing 0.7% of billing volume; Chargebee $0 + 0.8% or $99 + 0.65%. Israeli merchants pay their gateway a fixed monthly fee, so a fixed monthly fee from us may fit better than a percentage. Undecided.

## What changes in the plan

1. **The v1 provider question gets simpler.** Choose the gateway that is cheapest to start on and has the best primitives: a free sandbox, save without charge, idempotent charge, lookup by our id. Today that's Cardcom (free test terminal now, `ExternalUniqTranId`) or Pelecard (pending call details). Grow's 500 ILS a month from testing and its approval gate make it the costliest start.
2. **`ProviderCapabilities` gains the card updater.** Pelecard's Muhlafim (and whatever the others offer) is a per-gateway capability: a replaced-card feed updates our stored token. Without it, the fallback is the "update your card" flow we already have (slice 11) plus a pre-expiry reminder.
3. **Partnerships are a channel, not a gate.** Pelecard's and Cardcom's software-house programmes are referral schemes. Join them when we have merchants to refer; the referral fee is a small second income and the discounted rates are a selling point.
4. **Nobody else to contact for permission.** Not the card companies, not Visa or Mastercard. Shva only if we ever wanted to become a gateway, which we don't.

## Still open

- Pelecard's monthly cost and test terminal (from the call).
- Cardcom's monthly cost (email to Almog drafted, not sent).
- Whether a gateway exposes network tokens for card-on-file charges.
- Our pricing model: percentage of volume or fixed monthly.
