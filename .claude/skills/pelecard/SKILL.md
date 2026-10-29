---
name: pelecard
description: Use for anything about Pelecard (פלאקארד), the Israeli clearing and gateway company: what it is, its products (gateway, POS terminals, LinkBeClick, standing orders, PeleBilling, Muhlafim, Payper, Rav Mutav), its partner programme, its role relative to the card companies and Shva, and its APIs (PaymentGW init, services/DebitRegularType, ValidateByUniqueKey, GetTransaction, ReverseTransaction, UserKey, ParamX, ConfirmationKey, TotalX100, gateway21.pelecard.biz, billingapi.pelecard.biz). Also for the Pelecard sandbox, error codes, callbacks, 3DS, and our contacts and conversations with Pelecard.
---

# Pelecard

This file describes Pelecard on its own terms, as of 2026-10-21. It does not judge Pelecard against any design of ours.

Labels: **[C]** Pelecard's own site, docs or Pelecard-authored plugin. **[Call]** said by Pelecard on our call of 2026-10-21. **[Email]** written to us by Pelecard. **[3P]** a third party. **[?]** unverified.

## The company

- **Identity.** פלאקארד, Derech Eden 9, Rishon LeZion. Calls itself one of Israel's oldest clearing companies, "over 35 years". The site also says "since 1998"; LinkedIn and CB Insights say 1992. [C], [3P]
- **Size.** Private, 51–200 employees, "tens of thousands of clients, over 80,000 active terminals" (LinkedIn, self-reported). [3P]
- **Ownership.** Calcalist (2013) named Shlomo Hori as owner and CTO. No parent group or acquisition found. [3P], [?]
- **Compliance.** Certified PCI DSS Level 1, audited by a QSA. [C]
- **Regulatory status.** The site claims no Bank of Israel acquiring licence and no ISA payment-service licence. It processes "according to the Shva standard". [C] Which licence, if any, applies to it is not established. [?]

## What Pelecard is in the payments chain [Call]

Pelecard works directly with the card companies. The merchant's clearing agreement and supplier number (מספר ספק, `SapakNo`) are with a card company. Pelecard provides the technical layer, in the cloud (gateway, API, iframe) or physically (POS terminals), and charges the merchant a monthly fee for it. The money goes from the card company to the merchant, not through Pelecard. [Call], consistent with [C]: supplier numbers belong to the card companies, and funds are "credited to the business account according to the clearing arrangements".

## Products [C]

| Product | For |
|---|---|
| Payment gateway: iframe/redirect, REST services, plugins (Shopify, WooCommerce, Wix, Magento), Make.com connector | Websites and apps |
| POS terminals (N86, N6, N62, UN20), mobile cash register, Android SDK | Shops, mobile sellers |
| Installed payment software, works offline | Desktop charging |
| LinkBeClick payment links by email or SMS | Sellers without a site |
| Apple Pay, Google Pay, Bit, PayPal in the iframe | Checkouts |
| 3D Secure | Online card payments |
| Open banking bank-transfer initiation | Bank payments |
| Standing orders (הוראת קבע) and PeleBilling | Recurring billers |
| Muhlafim (replaced-card file) | Anyone holding stored cards |
| Batch billing (Shva file format) | High-volume billers |
| Card reconciliation, report generator | Finance teams, bookkeepers |
| Invoicing: Payper (Pelecard-managed), EZcount, iCount, Tamal | Tax documents |
| ERP and hotel integrations (SAP, Priority, Opera, Fidelio and others) | Larger businesses, hotels |
| Rav Mutav, Rav Sapak, Upay, Brand Split (routing to several supplier numbers or terminals) | Multi-beneficiary and multi-supplier setups |

Segments: large organisations, municipalities, small and medium businesses, exempt dealers, NGOs (discounted, no minimum), software houses and developers.

## How a merchant joins

- No self-service signup. The merchant leaves a lead and a representative calls back. Pelecard then issues a terminal number, user and password. [C]
- The merchant pays Pelecard a monthly fee. The clearing fee is the card company's. [Call]
- No pricing is published. Wix lists Pelecard "from 1.50% per transaction". [3P] Marketing mentions daily deposits and clearing within 24 hours. [C]

## Partners [C]

Seven partner types: website builders, ecommerce developers, programmers (API), software companies (a custom solution with Pelecard's developers), integrators ("over 400 systems"), bookkeepers and consultants. The partner integrates Pelecard and refers its clients. Pelecard gives the API, docs, samples, a test environment and support. Partners get a referral reward, described as "fair and transparent", with no rates published. White-label and reseller models are not mentioned.

## Pelecard's own recurring billing [C]

- **Standing orders.** The business sets the charge date and the system charges automatically. Tokens are stored under PCI. Replaced cards are switched "without stopping the process". Reports update on each success or failure.
- **PeleBilling.** A UI plus SOAP/ASMX services holding customers, standing orders, service codes, billing jobs and reports. Monthly on `dayInMonth` (1–28), `paymentsNo` payments. Billing runs as jobs and results are polled. Statuses: Active, Suspended, Not Started, Deleted. The docs describe no retry policy, no webhooks and no card-update method.
- **Muhlafim.** After each transmission the card companies report replaced, expired, blocked or cancelled cards (per Isracard, Visa/Cal, Leumi Card/Max). Pelecard updates the token automatically and publishes a replacement file (`services/GetTerminalMuhlafim`). A charge within a month of the last successful one is honoured, and the change is reported.
- **Recurring terminal.** A terminal set up for recurring payments runs the J5 check automatically on the first charge.
- Pelecard's own WooCommerce plugin lets WooCommerce Subscriptions run the schedule and charges tokens on a second "sub terminal" used for tokenisation and refunds. [C-plugin]

## APIs

### Families [C]

| Family | Base | Transport | Auth |
|---|---|---|---|
| Iframe/redirect | `https://gateway21.pelecard.biz/PaymentGW/` (`init`, `GetTransaction`, `ValidateByUniqueKey`) | JSON POST | Credentials in body |
| Services | `https://gateway21.pelecard.biz/services/{Method}` | JSON POST | `terminalNumber`, `user`, `password` in body |
| Payment links | `https://gateway21.pelecard.biz/PaymentEnquiry/CreateLink`, `/CancelLink` | JSON | `Terminal`, `User`, `Password`, `RepUser`, `RepPassword` |
| PeleBilling | `https://billingapi.pelecard.biz/WsPeleBilling{Customers,DirectDebits,Jobs,Reports,ServiceCodes}.asmx` | SOAP | `userName`, `password` |
| Muhlafim | `https://gateway20.pelecard.biz/services/GetTerminalMuhlafim` | JSON | Credentials in body |
| Batch | `https://batch.pelecard.biz:334/` (WCF, CLI, .NET DLL) | Shva IntIn/IntOt v96 files | Not stated |
| Reports | `https://reports.pelecard.biz` | Web UI only | Login |

The docs use both `gateway20` and `gateway21` without explaining the difference. The services builder lists 65 operations. Credentials must never be used client-side.

### Identity [C]

A 10-digit terminal number identifies the merchant's terminal, with its own user and password. `SapakNo` is the card company's supplier number. `BusinessNumber` is the business id. `ShopNo` / `shopNumber` defaults to 001.

### Payment page: `POST /PaymentGW/init` [C]

- Required: `terminal`, `user`, `password`, `GoodURL`, `Total`, `Currency`.
- Common optional: `ErrorURL`, `CancelURL`, `ActionType` (J2 card check and token, J4 debit (default), J5 authorisation, J5h), `CreateToken`, `ParamX`, `UserKey` (up to 50 chars), `ServerSideGoodFeedbackURL`, `ServerSideErrorFeedbackURL`, `FeedbackDataTransferMethod`, `MaxPayments`, `MinPayments`, `ThreeDSecure`, `ApplePay`, `GooglePay`, `PayperParameters`, `UserData1`–`UserData15`, `QAResultStatus`.
- Response: `StatusCode` (`"000"` success), `ErrorMessage`, `URL` (iframe or redirect target).
- J2 places no hold. J5 holds credit; the amount is free, 0.01 ILS is usual. [Email]

### Server-side charges [C]

- `services/DebitRegularType` (J4): `terminalNumber`, `user`, `password`, `shopNumber`, `creditCard`, `creditCardDateMmYy`, `token`, `total`, `currency`, `cvv2`, `id`, `authorizationNumber`, `paramX`, `eci`, `xid`, `cavv`. Returns `StatusCode`, `PelecardTransactionId`, `ShvaResult`, `DebitApproveNumber`, `DebitTotal`, `Token`, `RRN`.
- `DebitPaymentsType`, `DebitCreditType` add `paymentsNumber`, `firstPayment`. `AuthorizeCreditCard`, `AuthorizePaymentsType` are J5 holds. `CompleteDebitByUid` (`Uid`, `NewAmount`, `NewParamX`, `debitTrxId`) completes a hold.
- Token operations: `Convert to Token`, `Retrieve Token`, `Update Token`, `Check Credit Card For Token`. A token is 10 digits, one per card per terminal, usable across the terminal's regular and recurring terminals.
- The Pelecard plugin also sends `UserKey` with token charges. [C-plugin]
- 3DS on token charges is recommended, not required. [Email]

### Duplicates [Email], [C]

A duplicate is blocked only when the second transaction is fully identical to the first. Error 425 is "duplicate transaction". Whether a different `UserKey` makes a transaction "not identical" is unconfirmed. [?]

### Lookup and validation [C]

- `PaymentGW/ValidateByUniqueKey`: `ConfirmationKey`, `UniqueKey` (the `UserKey`, or the `TransactionId` if none was sent), `TotalX100`. Returns `1` valid, `0` not.
- `PaymentGW/GetTransaction`: `terminal`, `user`, `password`, `TransactionId`.
- `Trx Lookup`, `Get Transaction Data`, `Get Complete Transaction Data` exist in the services list. Lookup by `UserKey` or `ParamX` is not documented. [?]

### Refunds and voids

- `services/ReverseTransaction`: `terminalNumber`, `user`, `password`, `UID`, `NewAmount`, `NewParamX`, `NewPaymentNo`, `debitTrxId`. Recommended refund method. [Email] It must run on the terminal that made the original charge, otherwise 507. [C-plugin]
- In the Reports UI a void is possible only before the transmission to the card companies, and a refund only after it; both need an Admin user. [C]
- `Delete Tran Exp*` and `Reversal Exp*` also exist. [C]

### Status codes [C]

`000` success. 001–005 decline or confiscate, 006 bad CVV or ID, 007 bad CAVV/UCAF, 036 expired card. 501 bad credentials, 555 customer cancelled, 597 general error, 425 duplicate, 385/506 ECI required or invalid. PeleBilling uses 704–799. LinkBeClick uses `0` for success, Payper `200`. Full lists: the EMV/Shva status-code page on docs.pelecard.com and the error-messages PDF on gateway21.

### Amounts and currency [C]

Integers in agorot (`Total`, `total`, `TotalX100`). Currency codes: `1` ILS, `2` USD, `978` EUR, `826` GBP (PeleBilling lists EUR as `987`; one 3DS example uses `376`). Credit and instalment deals are ILS only.

### Callbacks [C]

POST to `ServerSideGoodFeedbackURL` / `ServerSideErrorFeedbackURL`, ports 80 or 443 only. Body is a form field named by `resultDataKeyName`, or raw JSON (`ServerSideFeedbackContentType: application/json`). HTTP 200 expected; one retry on failure. Source IP `31.168.172.190`. Not signed: confirm with `ValidateByUniqueKey` or `GetTransaction`. Browser redirect carries `PelecardStatusCode`, `PelecardTransactionId`, `ApprovalNo`, `Token`, `ConfirmationKey`, `ParamX`, `UserKey`.

### 3DS [C]

- Iframe: `ThreeDSecure: { Initiate, ForeignCard 0/1/2 }`. J4 in the iframe runs only with 3DS.
- Server-side: `services/Initiate3DSAuthenticationProcess` returns `TranStatus` (Y: keep `Eci`, `XID`, `Cavv`; C: redirect to `ChallengeUrl`), then poll `Get3dsData` by `RequestId` and pass `eci`, `xid`, `cavv` into the J5 or J4 call. Version 2.2.0 in the example. Apple Pay and Google Pay go through 3DS. Liability shift is not documented.

### Sandbox

- Tools: `https://gateway21.pelecard.biz/sandbox` (request builder), `/SandboxServices`, `/sandbox/landingpage`, `/services`. Example terminal `0882577012`. `QAResultStatus` simulates a result on test terminals only. No test cards published. [C]
- Our own test terminal is given only after we join and get a terminal. [Email]

## Our contacts and history

- 2026-10-19: emailed op@pelecard.co.il; operations answered the same day (J2/J5, 3DS, duplicates, `reverseTransaction`, Payper on tokens, test terminal after joining) and sent partnership to sales@pelecard.co.il, 03-6579500 ext 2.
- 2026-10-20: Shay Ozer, account manager (shayoz@pelecard.co.il), asked for a call.
- 2026-10-21 10:00: call with Shay. Pelecard's role in the chain as described above. [Call] Add further call notes here when Omer shares them.
- Technical support: support@pelecard.com.

## Sources

- pelecard.com: home, /api/, about, PCI, business partners, standing orders, FAQ, payment software, clients
- docs.pelecard.com: iframe-redirect-programmer-manual-version-06-2025, muhlafim-programmer-guide, pelebilling, 3dsecure-programmers-manual, additional-advanced-features, payment-link-with-rest-api, create-payper-invoice-api, reports, batch, emv-status-codes-error-messages
- gateway21.pelecard.biz/services, gateway21.pelecard.biz/sandbox
- WooCommerce plugin "Pelecard Gateway" v1.5.3.1, wordpress.org/plugins/woo-pelecard-gateway (`includes/Api.php`, `Gateway.php`, `Settings.php`)
- Wix help: support.wix.com/he/article/חיבור-חברת-הסליקה-פלאקארד-pelecard
- Calcalist 2013: calcalist.co.il/internet/articles/0,7340,L-3599270,00.html
- LinkedIn: il.linkedin.com/company/pelecard; CB Insights: cbinsights.com/company/pelecard
