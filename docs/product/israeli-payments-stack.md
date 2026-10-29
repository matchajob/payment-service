# Israeli card-payments stack

Research of 2026-10-21. **[C]** official or company source, **[3P]** press or law firm, **[?]** unverified. The Bank of Israel and Shva sites block automated reading, so some [C] items come from page titles or snippets.

## Who does what

| Layer | Who | Role | Regulator |
|---|---|---|---|
| Schemes | Visa, Mastercard; Isracard's local brand; Amex (via Isracard), Diners (via Cal) | Network rules, brands | n/a in Israel |
| Incumbent acquirers | Isracard, Max, Cal | Sign merchants, settle funds to them | Bank of Israel |
| New licensed acquirers | **Cardcom** (permanent licence July 2023, the first new acquirer in 23 years), **Tranzila** (permanent July 2024) [C, BOI] | Acquire directly, as well as running a gateway | Moving to the ISA |
| National switch | **Shva** (שב"א): routes every domestic card transaction between terminals and gateways, acquirers and issuers. Runs Ashrait (EMV), 3DS, standing orders. PCI DSS Level 1. About ILS 0.02 per transaction (2016) [C] | Certifies terminals | BOI-supervised; ownership capped by law |
| Gateways and terminal companies | **Pelecard**, Hyp (formed 2022 from four Max sister companies under Warburg Pincus), PayPlus ("Authorized Distributor of SHVA") and others | Technical layer: terminals, API, tokens; the merchant's clearing agreement is with an acquirer | **None claimed** (Pelecard) [C] |
| Licensed payment service providers | Grow Payments, PayMe, UPAY, Nayax, Google Payments, Revolut, Airwallex, Wise and others: 33 ISA licensees by June 2026 [3P] | Payment accounts, acquiring, initiation under the 2023 law | ISA |
| Billing software on top | (us; Chargebee abroad) | Calls a gateway's API on the merchant's behalf; no card data, no funds | **None found** [?] |

## The law

- **Strum committee and the 2017 law** separated Isracard and Max from the banks and allowed "hosting": a new acquirer can acquire through an existing acquirer's infrastructure. [3P], [C]
- **Regulation of Payment Services and Payment Initiation Law, 2023.** Licensing duty since 6 June 2024. The ISA licenses non-bank payment services: acquiring, issuing, payment accounts, payment initiation. Isracard, Max and Cal stay with the BOI. [3P]
- Draft minimum capital (check the final directive): acquiring or issuing ILS 500k, payment accounts ILS 1.4m, payment initiation ILS 200k. A drafted exemption for acquiring or issuing up to ILS 5m a month. [3P]
- **ISA staff position on platforms (25 Nov 2024):** a platform that takes a direct part in moving money from buyer to seller needs a licence, unless it uses another supervised entity to move the payment. [3P, Shibolet]
- No Israeli licence category called "sub-acquirer" or "payment facilitator" was found. [?]
- Since November 2023, acquirers licensed in the US, EU or UK may join Shva before getting an Israeli licence. [C]

## Becoming a gateway

- Shva alone certifies terminals against its Ashrait spec, a condition for connecting. New terminals must be EMV (BOI directive 472, from August 2017). [C], [3P]
- PCI DSS Level 1 as a service provider above 300,000 Visa transactions a year: annual on-site QSA audit plus quarterly scans. [C]
- No licence is stated for a pure gateway; Pelecard claims none. No public figures on certification time or cost. [C], [?]

## Software that only calls a gateway

No licence or approval requirement was found for software that touches neither card data nor funds. The ISA's test is direct participation in moving funds; PCI applies only to whoever stores, processes or transmits card data. [?], [3P], [C]

## Card companies and schemes as contacts

- Cal has a developer portal (cal-online.co.il/developer), but its APIs are for issuing, loans and leads, not acquiring. Isracard and Max: no public technology-partner programme found. [3P], [?]
- Visa Ready, Visa Acceptance ISV and Mastercard Engage are certification and marketing programmes; none grants acquiring rights. In Israel acceptance always goes through a licensed acquirer and Shva. [C], [3P]
- Shva: info@shva.co.il, 03-5264646, Harokmim 26, Holon. [C]

## Open, to ask directly

Shva's gateway certification process, cost and timeline; how each acquirer onboards gateways; the ISA's official licensee register; whether Israel defines a payfac status.

## Sources

- BOI press releases: permanent acquirer licence to Tranzila; b18-07-23 (Cardcom); 26-8-24; access for international payment service providers; Mastercard's 10% in Shva; BOI Payment Card Transaction Chain report (boi.org.il/media/nwxnn1k4/payment-card-transaction-chain-final-report-bank-of-israel.pdf)
- shva.co.il
- bizportal.co.il/general/news/article/20034820; funder.co.il/article/157949
- barlaw.co.il, gornitzky.com, shibolet.com/?p=19973, mondaq.com (payment services law)
- ice.co.il, en.globes.co.il, retailbankerinternational.com, calcalistech.com, protocol.co.il, finance.walla.co.il
- cal-online.co.il/developer; partner.visa.com (Visa Ready); visa payment facilitator model PDF; mastercard.com (Engage)
