# ADR 0010: Organizations own provider connections, applications use them

**Status:** Accepted, 2026-10-16 (proposed 2026-10-15). See "Amendments on acceptance" at the end.
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

## Amendments on acceptance (2026-10-16)

These come from reading the code against the proposal. Where they disagree with the Decision section above, these win.

1. **The pinned connection is enforced by the database too, not only copied in code.** `subscriptions` has `unique(subscriptionId, providerConnectionId)`. `payment_methods` and `charges` reference that pair with composite foreign keys, and `charges` also references `payment_methods (paymentMethodId, providerConnectionId)`. A charge path written later (renewal, dunning, slice 11) that copies the wrong connection id fails at the insert instead of charging a token through the wrong merchant account. This is the same reasoning as decision 1.
2. **No capabilities snapshot column.** Capabilities have one source: the adapter code. `createProviderConnection` builds the adapter from the new connection's credentials, runs `assertProviderSupported` on it, and only then inserts. A stored copy would go stale when an adapter gains a capability.
3. **Two factory shapes instead of one.** `buildProvider({ providerConnectionId, provider, credentials })` builds an adapter from plaintext credentials. It is used at creation, before any row exists. `providerFor(connection)` takes a stored row, opens its sealed credentials and calls `buildProvider`. It is async because opening goes through KMS. `createApp` takes `providerFor`.
4. **Credentials are an opaque sealed string.** The `CredentialCipher` port (`seal`, `open`) owns the envelope format, so the schema never changes when the format does. The KMS envelope implementation is owned separately, on the key that `iac/provider-credentials-key.ts` declares.
5. **`webhook_events` drops `tenantId` for `providerConnectionId`.** Events are stored before they're interpreted, and on the new route the tenant is unknown until the payload names a subscription. Dedup is `unique(providerConnectionId, dedupKey)`. A `:provider` path segment that doesn't match the connection's provider is `404`.
6. **`completeCheckout` looks the subscription up within the connection.** A webhook on connection X can't find, verify or charge a subscription pinned to connection Y. The tenant is loaded from the subscription.
7. **The statement descriptor is deferred to slice 13.** Whether Grow takes a per-transaction descriptor is only known once its API is read. `dynamicDescriptor` is not added to `ProviderCapabilities` until then.
8. **Two ciphers, chosen by environment (decided 2026-10-16, option A).** Local development seals with AES-256-GCM under a 32-byte key from `PROVIDER_CREDENTIALS_LOCAL_KEY`, so seeding needs no GCP access. Where `PROVIDER_CREDENTIALS_KMS_KEY` is set, as on every deployed service, the local key is never used, even if it is also set. Until the KMS envelope cipher lands (slice 20), sealing and opening there throw, and the server still boots. This is the same pattern as `unconfiguredProvider`. The rejected option B built the KMS cipher in this slice. It would have tied every local seed to GCP credentials, and key rotation deserves its own review.
