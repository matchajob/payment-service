# Chargebee case study

Research of 2026-10-21. **[C]** confirmed by Chargebee or the gateway, **[3P]** press or interviews, **[?]** unverified. Full source list at the end.

## Origin

- Founded May 2011 in a Chennai apartment by Krish Subramanian, Rajaraman Santhanam, Saravanan KP and Thiyagarajan Thiyagu. Two came from Zoho. They picked billing "because everyone needs to get paid", did no market sizing, and Krish "was not even a payment expert". [3P]
- Bootstrapped on savings, about $600 a month salary for years. [3P]
- Before launch, Krish answered recurring-billing questions on Hacker News, Stack Overflow and the Authorize.net and PayPal forums, which built a waitlist of hundreds. First customer: a UK subscription box on PayPal. Freshdesk was an early customer sharing their office. Alpha at about 12 months, beta at about 18, and nothing charged for over a year ("we did not charge early enough"). [3P]
- Funding: about $370K angels (2012), $800K Accel (2013–14), $5M Tiger (2015, at $100M processed a year), then C to H up to $250M at a $3.5B valuation (Feb 2022). About $470M raised in all. Layoffs of about 10% in 2022 and more in 2023; cash-flow positive by the end of 2023. [3P]

## Business model

- Software only. "The payment gateway directly manages the settlement process"; Chargebee charges no processing fee and does no payouts. [C]
- Sells billing, subscriptions, invoicing, dunning and recovery, revenue recognition, retention, receivables, CPQ, usage billing. [C]
- Pricing history: $49 and $249 plans (2017; a "10 free invoices" free tier backfired and low prices hurt trust with larger buyers), then the first $10K and later $50K of revenue free (copied from Braintree's Ignite), then free up to $100K with 0.5% overage. Today $0 + 0.80% or $99 + 0.65% of billing volume, enterprise custom. [3P], [C]
- Chargebee Payments came only after a decade: first through Finix (2022, Chargebee as "pass-through" and possible reseller or referral agent), then Adyen for Platforms (2024, the merchant contracts directly with Adyen). The regulated parts always sit with the partner. [C]

## Gateways

- **No permission needed at the start.** Every account describes a layer on public gateway APIs, using each merchant's own gateway account. Early gateways were PayPal and Authorize.net, then Stripe and Braintree. [3P]
- **Positioning: complement, don't compete.** "We complement Stripe, Braintree, PayPal… abstracting gateway complexity." Their "biggest competitor is the internal system you might build on top of Stripe/Braintree." [3P]
- **They didn't build every integration themselves.** They used Spreedly for gateway access and a PCI vault, and later replaced several Spreedly-routed integrations with native ones. [C]
- **Formal partnerships came later and are free:** a PSP partner track (Stripe, Adyen, PayPal, Braintree, GoCardless, Checkout.com and others) with no membership fee. No public revenue-share terms with gateways. [C], [?]
- **Regional gateways added per market:** Razorpay (India, 2022), EBANX and dLocal (LatAm, 2024), and others. Now "40+ gateways". [C]
- **Connecting:** OAuth for Stripe; credentials from the merchant's own account for others. Each stored payment method is tied to one gateway account (smart routing). [C]
- **Cards:** Chargebee is PCI DSS Level 1 as a service provider. Hosted pages and Chargebee.js keep merchants at SAQ A. It keeps no vault of its own: cards sit in the gateway's vault or Spreedly's, and Chargebee keeps the token, BIN, last four and expiry. [C]
- **Moving cards between gateways:** the old gateway sends card data to the new gateway's vault (often SFTP, Spreedly can receive), and Chargebee imports the new tokens. Some processors don't allow it, and some tokens (PayPal I-series) can't move at all. [C], [3P]
- No public account of a gateway refusing them or requiring certification. [?]

## Growth

- Content and support as the main channel, since Chennai had no local market. AdWords had poor ROI. SEO with Ahrefs. New sign-ups contacted within about two minutes. Revenue was half North American from the start. [3P]
- Once Stripe Billing launched (2018), Chargebee stayed gateway-neutral and moved upmarket into revenue recognition, CPQ and retention. [3P], [?]

## Regulation

No money-transmitter, e-money or payment-institution licence found. Core billing never holds funds; the compliance work is PCI DSS Level 1 plus GDPR. The payments product puts the regulated parts on Finix or Adyen. [C], [?]

## Lessons for payment-service

1. **Start on public gateway APIs with the merchant's own credentials. Partnerships come later and follow volume.** Chargebee had none of that at the start. Grow's gated platform track is the exception, not the rule.
2. **Stay software. Add payments only through a regulated partner, much later.** Chargebee waited a decade, and even then the merchant contracts with Adyen directly. Same line as ADR 0010.
3. **The real competitor is the merchant's in-house build on a gateway.** Our pitch is "don't build this yourself": dunning, idempotency, reconcile, events.
4. **Gateway-neutral is the moat.** Chargebee kept it after Stripe Billing launched. For us, Israeli gateways are where Stripe doesn't reach.
5. **Charge early, and not too cheaply.** Both are Chargebee's own regrets.
6. **Distribution through being helpful in the places developers ask.** Krish answered gateway-forum questions before launch. The Israeli equivalent: developer communities, and the gateways' own partner programmes (Pelecard's and Cardcom's software-house tracks).
7. **Card portability is gateway-dependent.** Tokens are tied to the terminal that made them, and moving them needs the gateways' cooperation.

## Sources

- insightpartners.com/ideas/how-krish-subramanian-built-global-saas-unicorn-chargebee-out-of-india
- research.contrary.com/company/chargebee
- accel.com/news/how-chargebee-made-its-first-million
- mixergy.com/interviews/chargebee-with-krish-subramanian
- saastock.com/blog/ama-with-krish-subramanian-ceo-of-chargebee
- techcrunch.com (2015 Series B; 2021 valuation); inc42.com; fintechfutures.com; yourstory.com; entrackr.com; pymnts.com; accountingtoday.com
- chargebee.com/docs: is-chargebee-a-gateway, stripe-configuration, gateway_settings, migrating-cards, PCI compliance
- support.chargebee.com/support/solutions/articles/15298
- spreedly.com/customers/chargebee
- chargebee.com/payment-gateways, /partners, /pricing, /payments/embedded, /payments-tou, /embedded-payments-tou
- thefintechtimes.com (Razorpay partnership); chargebee.com/blog/payment-techstack-innovations-may-2024; release-notes.chargebee.com/june-2026
- stacksync.com/blog/fourteen-months-of-zero-customers-the-origin-story-of-chargebee (secondary)
