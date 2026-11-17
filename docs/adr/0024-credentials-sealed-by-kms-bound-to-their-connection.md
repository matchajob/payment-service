# ADR 0024: Provider credentials are sealed directly by Cloud KMS and bound to their connection

**Status:** Accepted, 2026-11-17
**Amends:** WORKPLAN slice 20 ("envelope `CredentialCipher`, a fresh data key per seal"). Completes ADR 0010 amendments 4 and 8.
**Fixes:** code-review-1 N5, and the KMS half of H6.

## Context

Every deployed service had `PROVIDER_CREDENTIALS_KMS_KEY` set and a stub cipher that threw, so no provider call could work in production. Two questions were open:

- **Envelope or direct.** The plan was envelope encryption: a fresh AES data key per seal, wrapped by KMS. That pays off when the data key is cached or the payload is large. Here neither holds: a connection's credentials are a few hundred bytes (KMS takes up to 64 KiB), and with a fresh key per seal every seal and every open is one KMS call either way.
- **Binding.** Without binding, anyone who can write to the database can copy one organization's sealed credentials onto another organization's connection row, and charges go through the wrong merchant account.

## Decision

1. **Direct KMS encryption (Omer, 2026-11-17).** `seal` sends the credentials to `{key}:encrypt`, `open` sends the ciphertext to `{key}:decrypt`. The sealed string is `kms-v1.<ciphertext>`. No encryption code of our own.
2. **Bound to the connection (Omer, 2026-11-17).** `CredentialCipher` takes the connection id on both `seal` and `open` and passes it as associated data (KMS `additionalAuthenticatedData`, GCM AAD locally). A blob opened under any other id fails. `createProviderConnection` already generates the id before it seals, and `providerFor` has it from the row.
3. **Rotation needs nothing.** Calls name the key, never a key version. KMS reads the version from the ciphertext, so blobs sealed before the 90-day rotation still open.
4. **No SDK.** `src/infra/gcp-kms` calls the KMS REST API over the injected `fetch`, like Grow and Stripe (ADR 0020). The access token comes from the Cloud Run metadata server and is reused until a minute before it expires.
5. **The local cipher binds too, as `local-v2`.** `local-v1` values no longer open. Only local development databases hold them; re-run `pnpm db:seed`.

## Consequences

- A KMS outage makes `providerFor` reject, so the request or cron run fails loudly. It never yields wrong credentials.
- `pnpm db:seed` against a deployed database works only where the metadata server answers, that is from inside GCP. The onboarding runbook (slice 16) runs it there.
- Moving off Cloud KMS means decrypting and re-sealing every row once. Envelope encryption would have allowed re-wrapping keys only; with a handful of rows per organization that saving doesn't matter.
