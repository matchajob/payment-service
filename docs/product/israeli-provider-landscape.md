# Israeli provider landscape

Research of 2026-10-19 from each provider's public docs. "?" means the docs were silent and the question is in the outreach email. Re-check against the provider's answer before any ADR relies on a row.

## Fit with the PaymentProvider port

| | Grow | Cardcom | Hyp | PayPlus | Tranzila | Pelecard |
|---|---|---|---|---|---|---|
| Access model | **Gated**: approved platform partner, platform `apiKey` | Open; multi-merchant FAQ, terminals opened by API with Cardcom KYC | Open? Two APIs (Pay, Enterprise) by terminal | Open; "tell us before you integrate" | Open; partner form | Open; referral form |
| Save card, no charge | `chargeType=3` (hold?) | `CreateTokenOnly` + J2, no hold | J2 / J102 token, no hold | `charge_method` 5 (J2), hold? | `tranmode=K`/`N`, no hold | `CreateToken` + J2, hold? |
| Token charge, customer absent | `createTransactionWithToken` | `Transactions/Transaction` + `IsAutoRecurringPayment` | Pay `soft` / Enterprise `doDeal` | `Transactions/Charge` `use_token` | `transaction/credit_card/create` | `DebitRegularType` |
| Our own unique id blocks a duplicate | `transactionUniqueIdentifier` (error code?) | **Yes**, `ExternalUniqTranId`, error 608 or original response; reserved only after approval | Enterprise `uniqueid`, 24h | No | `DCdisable`, 24h, not after a failure | `UserKey`/`ParamX`? |
| Look up a charge by our id | `getTokenTransactionsByExternalIdentifiers` (shape?) | **Yes**, `GetTransactionByExternalUniqTran` | Via `user` field | Via `more_info` | Reports API on `user_defined_*` | Undocumented |
| Signed webhooks | No | No (docs say re-fetch with `GetLpResult`) | Enterprise: SNS-signed | **HMAC-SHA256** `hash` header | No | No (validate by key) |
| Tax invoice per charge | ? | `Document` object on the charge | Hyp Invoice (Pay) | Invoice+ add-on | Separate documents API | Payper |
| Refunds API | Yes | Yes | Yes | Yes | Yes | Credit/void (inferred) |
| Sandbox | By request | By request (terminal 1000) | By request | By request | By request | Public sample terminal |
| Platform fee | `companyCommission` per transaction | Wallet transfer from merchant | ? | Referral rev share | ? | Referral payment |

## Reading

- **Cardcom is the best second adapter.** It is the only one with both duplicate refusal on our id and lookup by our id, which is exactly what ADR 0008 (dedup key) and ADR 0017 (reconcile by dedup key) assume. It also has a documented multi-merchant platform model. Its caveat: a declined id can be reused, and a timeout's state is unknown, so reconcile still matters.
- **Hyp Enterprise** is the runner-up: signed webhooks and a 24h `uniqueid`.
- **PayPlus** has the best webhook story (HMAC, so D11 applies) but no idempotency, so every ambiguous charge waits for reconcile, like Grow.
- **Tranzila's** 24h dedup that skips failed attempts doesn't cover dunning retries days apart; our attempt-scoped dedup key still has to carry it.
- Every provider except Grow lets a merchant's own credentials suffice, as Chargebee's gateways do. Grow is the only one where the provider's approval is in the protocol.

## Replies

### Grow (2026-10-20, Olga, operations, via support@grow.business)

- Before forwarding to the API department they asked: what we sell, whether customers are Israeli and charged in ILS, our live website and whether it is built on a platform or our own code, and whether we clear for ourselves or let businesses clear under our interface.
- **API use costs 500 ILS + VAT per month, charged from the testing stage.** Docs: grow-il.readme.io/reference/overview-6; service terms: grow.business/payment-bid/.
- Still open: whether the fee is per platform or per merchant, and whether platform partners are priced differently. Per merchant would add 500 ILS a month to every tenant's cost and break the pitch for small merchants.

### Cardcom (2026-10-20, Kobi, support)

- **Costs and joining:** sales, Sales@secure.cardcom.co.il or 03-9436100.
- **3DS:** not required. Usually demanded only for tourist cards. Token charges never go through 3DS; only the initial deal does, and only with the 3DS module.
- **`ExternalUniqTranId`:** can't be reused once a charge with it succeeded. After a decline **or a timeout** the same id may be sent again. So after an ambiguous failure, resending with the same id is safe: it charges at most once. This is real idempotency, the only one among the providers. The adapter can retry an ambiguous charge with its dedup key instead of leaving it `pending` for reconcile (slice 25's "never retry an ambiguous failure" is Grow-specific).
- **Webhooks:** always confirm with `GetLpResult`. Same as webhook rule 3.
- **Sandbox:** test terminal credentials received by email (2026-10-20). Kept out of the repo; they belong in a local, uncommitted env file.
- **Partner program (2026-10-21, Almog R., sales, Almog.r@secure.cardcom.co.il, PDF):** a referral scheme. Personal link; businesses signing up through it get discounted rates and are onboarded by Cardcom. Reward: (merchant's clearing fee − 0.65%) × 20% of monthly volume, for the merchant's lifetime (example: 1.2% on 50,000 ILS a month gives 55 ILS a month). Expectation about 2 referrals a month; Cardcom may end it by email for low activity. Paid once 500 ILS has accrued, net+25 after the partner's invoice. Signing needs a legal business name and עוסק/ח.פ. number. It says nothing about platform access, holding merchants' credentials, or our own terminal's price.

### Pelecard (2026-10-19, from op@pelecard.co.il)

- **Partnership:** go to sales, sales@pelecard.co.il or 03-6579500 ext 2. Emailed sales 2026-10-19. On 2026-10-20 Shay Ozer, account manager (shayoz@pelecard.co.il), asked for a call; Call set for 2026-10-21 10:00.
- **Save card:** J2 places no hold. J5 holds credit; the amount doesn't matter, 0.01 ILS is usual. So `saveCardWithoutCharge` is J2 with `CreateToken`.
- **3DS:** a service they offer, recommended but not required. Token charges with the customer absent need no 3DS step.
- **Duplicates:** blocked only when the second transaction is fully identical to the first. There's no id-based idempotency; our attempt-scoped dedup key and reconcile carry it, as with Grow. Still open: does a different `UserKey` make it "not identical", and can a charge be looked up by `UserKey`?
- **Refunds:** `reverseTransaction`.
- **Invoices:** Payper issues invoices on token charges too.
- **Sandbox:** a test terminal only after we join and get a terminal.
- Not answered: rate limits.

### Tranzila (2026-10-20, ticket 730000969, from support@interspace.net)

- **Partnership and test terminal:** both go through sales. No sales email given; phone 073-2224444, WhatsApp 073-2224488. Asked on the ticket (2026-10-20) to be put in touch with sales.
- **Save card:** a token is created with `TRANMODE=VK`, which **places a hold** (1 ILS recommended). No hold-free tokenization was offered, so on Tranzila `saveCardWithoutCharge` means a 1 ILS authorization that is never captured. It moves no money, but the customer may see a pending 1 ILS.
- **3DS:** 3DS parameters can be passed on a token charge; whether to is our choice. Not required.
- **Lookup:** a transaction can be fetched by the extra fields attached to it, so lookup by our dedup key works.
- **Notify:** not signed. Verify by source IP range 80.244.170.0/24. We still treat it as untrusted and verify by lookup (webhook rule 3); the IP check is an extra filter, not a trust signal.
- **Rate limits:** none.
- Not answered: what happens after a timeout when `DCdisable` skips failed attempts. Lookup by our id covers it.

## Grow's own recurring billing

From developers.grow.business/reference/billing (2026-10-19):

- A fixed sum charged monthly for up to 180 months, created on a dedicated `pageCode`. The server-to-server confirmation happens only at setup.
- The amount, customer details, card, charge date and number of charges can be changed, or the charge canceled, in Grow's business management interface.
- A failed charge is retried for up to 10 days, never past the end of the month. Merchant and customer are notified, and the customer gets a link to update the card.
- A webhook on each success and failure.
- The page says nothing about plans, trials, proration, entitlement, invoices per charge, or dunning after month-end.

What we add on top: a lifecycle state machine behind an API, dunning on the tenant's schedule across month boundaries, grace entitlement, signed and sequenced snapshot events, idempotent requests, a typed SDK, double-charge guards with hourly reconcile, and the same contract over any provider. Grow's feature is a dashboard tool for a merchant; ours is an engine a developer builds a product on. The pitch goes to companies with a developer, not to merchants who manage billing by hand.

## Contacts

| Provider | Partnership | Technical / sandbox |
|---|---|---|
| Grow | support@grow.business (sent 2026-10-19) | same |
| Cardcom | Sales@secure.cardcom.co.il, 03-9436100 ext 2 | support@secure.cardcom.co.il, ext 1 |
| Hyp | sales@hyp.co.il | cg-support@hyp.co.il |
| PayPlus | partner form at payplus.co.il/affiliates | tech@payplus.co.il, 03-9444788 |
| Tranzila | form at tranzila.com/שותפים-עסקיים | support@tranzila.com, WhatsApp +972-73-222-4488 |
| Pelecard | sales@pelecard.co.il, 03-6579500 ext 2 (per their reply) | support@pelecard.com |

## Sources

- Cardcom: cardcom.solutions/partners, secure.cardcom.solutions/swagger/v11/swagger.json, support.cardcom.solutions/hc/he/articles/38129750491666, cardcomapi.zendesk.com/hc/he/articles/26981976399122
- Hyp: developers.hyp.co.il (enterprise/introduction/contacts, pay/common-use-cases/tokenization, enterprise/payment-page-integration/webhooks)
- PayPlus: docs.payplus.co.il/reference/introduction, /validate-requests-received-from-payplus, payplus.co.il/affiliates
- Tranzila: docs.tranzila.com/docs/payments-and-billing/tranzila-api, tranzila.com/שותפים-עסקיים
- Pelecard: docs.pelecard.com, pelecard.com/שותפים-עסקיים
- Grow: developers.grow.business/reference/api-guidelines-for-platforms-system-integrators, /live-environment
