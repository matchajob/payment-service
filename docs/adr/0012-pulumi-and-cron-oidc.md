# ADR 0012: Pulumi on GCS state, one stack per environment; cron calls authenticate with OIDC

**Status:** Accepted, 2026-10-16
**Slice:** 0.6. Amends ADR 0002 (cron auth). Serves ADR 0010 (provider credentials key).

## Context

Slice 0.6 declares every GCP resource the service runs on, so nothing is clicked in a console and staging cannot drift from production. Its rule is that no secret value enters the stack config or state, even though state is encrypted. State is a file that gets copied, backed up and read by every deployer. Encryption protects it at rest, not from anyone who can run `pulumi stack export`.

That rule collides with ADR 0002. Cloud Scheduler would have to send `Authorization: Bearer <CRON_SECRET>`, and Pulumi can only set that header by holding the value. Three ways out were weighed:

- **A. OIDC.** Scheduler signs a Google ID token as a dedicated service account (`cron-invoker`). The service verifies the signature, the audience and the email. Nothing secret exists to store.
- **B. Read the secret into state.** No app change, but it breaks the slice rule and copies the secret into Scheduler's job config as well.
- **C. Placeholder header, real value set by hand.** Nothing in state, but a manual step per environment that Pulumi can't see and that drifts.

## Decision

### Cron auth: A

- Scheduler jobs carry `oidcToken { serviceAccountEmail: cron-invoker, audience }`. The audience is the fixed string `payment-service-<environment>-cron`, not the service URL. The URL is an output of the service, so it can't also be an input to the service's own env without a cycle.
- The service gets `CRON_INVOKER_EMAIL` and `CRON_AUDIENCE` as plain env vars. Neither is secret.
- `cronAuth` verifies the token behind a port (`CronTokenVerifier`). Production uses Google's public keys. Tests inject a fake, which answers ADR 0002's objection that OIDC is not testable through `app.request()`.
- `CRON_SECRET` is retired once that change lands. Until then the service still requires it, so the first deploy of the real image (slice 0.5) waits for the swap.
- Cloud Run itself stays publicly invocable (`invokerIamDisabled`). Tenants authenticate with API keys and Grow's webhooks carry no Google identity, so Cloud Run IAM can't gate the service. `/internal/cron/*` is closed by the app, as before.

### Pulumi

- TypeScript, in `iac/` at the repo root. Not `src/infra`, which is the portable code layer. It uses the root `package.json` and runs through `tsx`, the same loader the app uses. It may import `@/lib/env-names`, so an env var the program sets and the name the app reads can't drift. Typecheck enforces that.
- State in a GCS bucket per GCP project (`gs://<project>-pulumi-state`, versioned). The secrets provider is a Cloud KMS key in the same project. No extra vendor, and access is GCP IAM.
- One stack per environment, `staging` and `production`, each in its own GCP project. The stack name is the environment.
- CI (`.github/workflows/infra.yml`) runs the iac unit tests, then `preview` on staging on every push that touches infra and on production from `main` only, then `up` on staging from `main`. Production is applied by hand. CI authenticates through Workload Identity Federation. No JSON key exists.
- The staging pool trusts any branch of this repository, so branches can preview. The production pool also requires `assertion.ref == "refs/heads/main"`. The deployer is close to project owner, and a rule in the workflow file can be edited on the branch it runs from. The `ref` claim is signed by GitHub, so a branch can't fake it.

### What the program owns

APIs, Artifact Registry, the runtime and cron-invoker service accounts, the Cloud SQL instance and database, Secret Manager secrets (empty), the Cloud Run service, the Scheduler jobs, the KMS key ring and `provider-credentials` key for ADR 0010 (90-day rotation, runtime account is encrypter/decrypter), and the GitHub deployer identity.

### What it deliberately does not own

- **Secret values.** The program creates `database-url` without a version. The value is added with `gcloud secrets versions add`.
- **The Cloud SQL user.** `gcp.sql.User` would put its password in state. The user is created once with `gcloud sql users create` and its password lives only in the `database-url` secret.
- **The state bucket and the state KMS key.** A program can't hold its own state. Created once by the bootstrap below.

## Bootstrap, once per GCP project

```sh
PROJECT=<gcp-project> REGION=me-west1 STACK=staging
gcloud storage buckets create gs://$PROJECT-pulumi-state --project $PROJECT --location $REGION --uniform-bucket-level-access
gcloud storage buckets update gs://$PROJECT-pulumi-state --versioning
gcloud kms keyrings create pulumi --project $PROJECT --location $REGION
gcloud kms keys create state --project $PROJECT --location $REGION --keyring pulumi --purpose encryption

cd iac
pulumi login gs://$PROJECT-pulumi-state
pulumi stack init $STACK --secrets-provider "gcpkms://projects/$PROJECT/locations/$REGION/keyRings/pulumi/cryptoKeys/state"
pulumi config set gcp:project $PROJECT
pulumi config set gcp:region $REGION
pulumi config set githubRepository matchajob/payment-service

# Cloud Run rejects a revision whose secret has no version, so everything but the service and its Scheduler jobs first.
pulumi up --exclude "urn:pulumi:$STACK::payment-service::gcp:cloudrunv2/service:Service::payment-service" --exclude-dependents

PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')
gcloud sql users create payment_service --instance payment-service --project $PROJECT --password "$PASSWORD"
printf 'postgresql://payment_service:%s@/payment_service?host=/cloudsql/%s' "$PASSWORD" "$(pulumi stack output databaseConnectionName)" \
  | gcloud secrets versions add database-url --data-file=- --project $PROJECT
unset PASSWORD

pulumi up
```

Then set the GitHub environment `$STACK`: vars `GCP_WORKLOAD_IDENTITY_PROVIDER` (stack output `workloadIdentityProvider`), `GCP_DEPLOYER_EMAIL` (output `deployerEmail`), `PULUMI_BACKEND_URL` (`gs://$PROJECT-pulumi-state`), and secret `MATCHA_INFRA_DEPLOY_KEY` (ADR 0001). The deployer also needs `roles/cloudkms.cryptoKeyEncrypterDecrypter` on the `pulumi/state` key, granted by hand, because that key is outside the program. For `production`, also restrict the GitHub environment's deployment branches to `main`.

## Consequences

- `pulumi destroy` can't take the database, the secrets or the KMS keys: they are `protect`ed, and the instance has deletion protection on both the Pulumi and the GCP side. KMS keys can't be deleted in GCP anyway, only their versions destroyed.
- The image is stack config (`image`), defaulting to Google's placeholder until slice 0.5 pushes a real one.
- `tests/unit/iac` runs the program under Pulumi mocks and pins the rules: secrets are references only, no secret version or SQL user is declared, every Scheduler job is OIDC-signed and has no `Authorization` header, the KMS grant exists, and the job list equals the app's cron routes.
- The deployer account is close to project owner. That is the nature of a principal that runs `pulumi up`. WIF limits who can become it to this repository's workflows.
