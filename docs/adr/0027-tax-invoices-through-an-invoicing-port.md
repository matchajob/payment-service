# ADR 0027: Tax invoices through an invoicing port, one per succeeded charge

**Status:** Accepted, 2026-11-17

## Context

Israeli law requires a tax invoice (חשבונית מס, or a receipt-invoice) for every payment, and above 5,000 ILS for a business customer it needs a Tax Authority allocation number. We are building for many payment providers. Only some issue invoices themselves (Cardcom documents, Pelecard Payper, Hyp Invoice), so payment-service has to issue them where the provider doesn't.

The invoice is issued by the tenant's business to the tenant's customer, never by us. So the invoicing account belongs to the tenant, just as its terminal does (bring your own account).

## Decision

1. **An invoicing connection per organization.** `invoicing_connections` holds the service (`morning` for now) and its credentials, sealed by the credential cipher and bound to the connection's id (ADR 0024). A tenant points at one through the nullable `tenants.invoicing_connection_id`. A composite FK keeps that connection inside the tenant's own organization, so invoices never go out in another business's name.
2. **A connected tenant gets an invoice for every succeeded charge. A tenant with no connection gets none.** Whether the provider can issue invoices itself is only shown at onboarding. It doesn't route anything.
3. **The work is derived from state, not hooked into the charge writers.** Every run of `/internal/cron/issue-invoices` first inserts an `invoices` row for each succeeded charge that has none, where the tenant has an invoicing connection. That covers every success path: a first charge, a renewal, a dunning or immediate retry, a late success found by reconcile, the settle CLI. A unique `charge_id` keeps it to one invoice per charge. Charges taken before the connection existed are left alone, so history is never invoiced by surprise.
4. **Issuing is leased and retried like the outbox (ADR 0009).** A claim counts the attempt and leases the row. Failures retry after 1m, 10m, 1h, 6h and 24h. After the 6th attempt the row is `dead`, and an error is logged with the charge id, which raises the service-error alert. Results are fenced on `attempts`, so a stale writer can't overwrite a newer attempt.
5. **A retry never issues a second invoice.** The reference we send is the `invoice_id`, and it stays the same across attempts. From the second attempt on, the drainer calls `findIssued(reference)` before `issue`, because an earlier attempt may have created the invoice and lost the answer. Each adapter has to implement that lookup. A service that can't look up by our reference can't be adapted safely.
6. **The cron answers 200 when the invoicing service fails,** as `drain-outbox` does (ADR 0026). The retry schedule handles it, and a dead invoice raises an alert.
7. **What goes on the invoice:** the charge's amount, currency, payment time and provider charge ref, the plan name as the line description, and the customer's optional billing details: name, email and tax id. The tax id is a ח.פ. or ת.ז. Without billing details the invoicing service's walk-in customer is used. The tax id makes B2B invoices and allocation numbers possible.

## Consequences

- No adapter exists yet. Production's `buildInvoicer` refuses every service, so no invoicing connection can be created until the Morning adapter lands. That is the next slice. It first has to settle how Morning finds a document by our reference.
- Refunds and credit notes are out of scope, because v1 has no refunds.
- Customers can only receive billing details at creation. Updating them needs a customer update endpoint, which doesn't exist yet.
- The queue query scans succeeded charges with no invoice row. If that gets slow, a partial index on succeeded charges is the fix, together with M15.
