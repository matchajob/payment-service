# ADR 0010: Organizations own provider connections, applications use them

**Status:** Proposed, 2026-10-15
**Slice:** 19 (new). It changes the tenant schema, so it lands before slice 8 adds renewal charges.

## Context

The service is to be offered as a hosted product (see `docs/product/hosted-service-strategy.md`). Two parts of that pitch reach the schema:

1. **Bring your own provider.** Each customer charges through its own merchant account at Grow, or later another provider, and pays that provider's fees directly. We never hold the money. If money flowed through our merchant account instead, we would be a payment facilitator, which most likely needs a license under Israel's 2023 Payment Services Law. We would also carry the chargeback risk of every customer. This ADR assumes we stay a software vendor. A lawyer should confirm that before the first paying customer.
2. **Pay for a provider once, use it in many apps.** A business with several products, or a software house with its own portfolio, opens one merchant account (one terminal and one monthly fee) and connects several applications to it.

The code today has one `tenants` row that plays three roles at once: the API-key holder, the receiver of outbound events, and the implied owner of the provider account. The provider itself is a single `PaymentProvider` instance passed to `createApp`. That is one set of Grow credentials for the whole deployment, set by app config. Slice 17 already noted that this blocks a sandbox tenant in production.

### The legal boundary the model must encode

Sharing one merchant account across applications is fine **only when every application belongs to the same legal entity**. If unrelated businesses share an account, that is payment aggregation, which card scheme rules forbid without registration. The schema should make that boundary structural, not a clause in the terms of service.

## Options

### Shape of the tenancy tree

- **A. Keep `tenants` as the application, add two tables above it.** `organizations` is the legal entity, and `provider_connections` belongs to an organization and holds the credentials. `tenants` gains `organizationId` and `providerConnectionId`. Every existing `tenantId` foreign key, the API-key auth, the outbox and the webhook secret stay as they are.
- **B. Rename `tenants` to `applications` and make `tenant` mean the organization.** The names are cleaner, since in SaaS speech "tenant" usually means the paying customer. The cost is touching every table, test fixture, contract field and ADR that says `tenantId`.

**Recommendation: A.** "Tenant" keeps its meaning in this repo: the thing with an API key that receives events. That matches what the specs already say. The GLOSSARY entry (to be written) names "organization" as the legal entity. B can still happen later as a pure rename if the naming causes real confusion with customers.

### Where credentials live

- **A. An encrypted column on `provider_connections`.** Envelope encryption: a data key per row, wrapped by a Cloud KMS key that the Pulumi program (slice 0.6) declares. One read per charge, and no extra network call beyond KMS, which can be cached.
- **B. One Secret Manager entry per connection, with the row storing the secret's name.** Rotation and audit come for free. But it is a network call per charge, and Secret Manager quotas and costs grow with every customer.

**Recommendation: A**, with the KMS key per environment. Credentials never appear in logs, in problem responses or in the `read` schema of the entity.

## Decision (proposed)

```
organizations                 the legal entity; one per customer business
  └─< provider_connections    provider + encrypted credentials + capabilities snapshot
  └─< tenants                 the application: API key, webhookUrl/secret, policy knobs, plans
        └── providerConnectionId → a connection of the SAME organization
```

1. **Same-organization rule, enforced by the database.** `tenants` has a composite foreign key `(organizationId, providerConnectionId)` → `provider_connections (organizationId, providerConnectionId)`. An application can't point at another organization's connection, whatever the API layer does.
2. **A subscription pins its connection at creation.** `subscriptions.providerConnectionId` is copied from the tenant when the subscription is created and never changes. A card token is only valid inside the merchant account that captured it. If a tenant switches connections later, existing subscriptions keep charging through the old one, and new ones use the new one. `payment_methods` and `charges` carry the same `providerConnectionId`, so a token is never presented to the wrong account.
3. **The provider becomes a factory.** `createApp` takes `providerFor(connection) → PaymentProvider` instead of one `provider`. The `PaymentProvider` port doesn't change. The adapter is built per connection with that connection's decrypted credentials. `assertProviderSupported` moves from boot time to the moment a connection is created. A connection whose provider lacks `saveCardWithoutCharge` is refused when it's created, not when the whole app boots.
4. **Inbound webhooks are routed by connection, not by tenant.** The route becomes `/v1/webhooks/:provider/:providerConnectionId`, with an unguessable id. The subscription, and through it the tenant, is found from the checkout `reference` inside the verified payload. Webhook dedup is scoped per connection. This holds whether Grow lets us set the notify URL per transaction or only per account. Which one it is gets confirmed in slice 13.
5. **Outbound events are unchanged.** They're still per tenant, with the tenant's `webhookUrl` and secret. The organization never receives events directly.
6. **Statement descriptor.** Every application on a connection shows the merchant account's name on the customer's card statement, unless the provider supports a descriptor per transaction. That becomes a capability flag (`dynamicDescriptor`), with the fallback being the account's fixed name. Tenant onboarding warns about this, because an unfamiliar name on a statement causes chargebacks.

## Consequences

- Most migration work is additive. There's no production data yet, and `drizzle/` is regenerated in development (slice 0.2), so the change costs a schema edit, not a data migration.
- Every charge path (charge #1 now, then renewal in slice 8, dunning in slice 10 and the slice 11 retry) resolves the provider from the subscription's pinned connection. Doing this before slice 8 means renewal is written against the factory once.
- The fake provider in tests becomes a fake factory. Tests can then prove a token from connection X is never charged through connection Y.
- The test tenant (slice 17) can live in production with a sandbox connection. That resolves the second slice 17 decision.
- Reconciliation per application is free: every charge row already carries `tenantId`, so payouts on a shared merchant account can be split by application.
- **Not decided here, deferred:** reusing a customer's card across sibling applications of one organization. The token technically allows it, but it needs the customer's consent and a customer identity shared across tenants. Organization-level API keys and a dashboard login are also deferred. Today every API key belongs to an application.
- **Open:** whether we verify that an organization really is one legal entity (for example, the registration number on its merchant account matches the organization's) or rely on contract terms. To decide with the lawyer.
