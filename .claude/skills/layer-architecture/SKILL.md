---
name: layer-architecture
description: This skill should be used when the user asks to "add a 3rd-party integration", "wrap a library", "add an adapter", "add an SDK", "where does this code go", "which layer", "is this portable", "add to infra", "infra can't import lib", "no-restricted-imports error in infra", "ports and adapters here", "add a provider", "swap a provider", or anything about the infra/ vs lib/ vs app/ layer boundary and the enforced portability rule.
version: 0.1.0
---

# Layer Architecture — infra / lib / app

Layers are tiers by **portability**, not by file type. One enforced rule: `infra/` must be liftable into another repo tomorrow.

| Layer | Holds | May import |
|---|---|---|
| `src/infra/` | project-agnostic 3rd-party wrappers + machinery (DZD, ts-utils, supabase/pino wrappers). Knows nothing about jobs/employees. | only `@/infra/*` + node_modules |
| `src/lib/` | this project's domain: `env`, `db`, auth/feed/profiles, and the **re-wraps** that bind infra wrappers to project config/interfaces | `@/infra/*`, `@/lib/*` |
| `src/app/` | the edge — UI / entry that consumes `lib` | `@/lib/*`, `@/infra/*` |

`src/trpc/`, `src/api/` are edge/server tiers above `lib`. `db` lives at `src/lib/db/` (it is domain).

## The invariant (enforced)

`eslint.config.mjs` has a block scoped to `src/infra/**` that errors on any `@/(lib|db|trpc|api|app)` import via `no-restricted-imports`. If you hit that error: the infra file is reaching into domain code — inject the dependency instead (see below).

## The pattern: wrap in infra, re-wrap in lib

A 3rd-party integration is split across two files:

- **infra wrapper** — a `make*` factory taking **injected config** (URLs, keys, clients). No `@/lib/env`, no `@/lib/db`, no domain interface. Exposes generic primitives.
- **lib re-wrap** — imports the infra factory + `env` + `db` + the domain interface, feeds config in, and binds to the domain contract.

Domain composition that needs the DB lives in the **lib** re-wrap, never infra. Example: Supabase `getUserId` = infra `verifyToken(token) → {sub}` **then** a `usersTable` lookup done in lib.

### Reference: Supabase

| File | Layer | Role |
|---|---|---|
| `src/infra/supabase/client.ts` | infra | `makeSupabaseClients({url,anonKey,serviceKey})` |
| `src/infra/supabase/auth.ts` | infra | `makeSupabaseAuth(clients,{jwksUrl})` → `verifyToken`, createUser, signIn… |
| `src/infra/supabase/storage.ts` | infra | `makeSupabaseStorage(clients)` → raw list/signedUrl/remove |
| `src/lib/supabase-clients.ts` | lib | feeds `env.SUPABASE_*` into the factory; exports configured singletons |
| `src/lib/auth/supabase.ts` | lib | `supabaseAuthProvider: AuthProvider` (verifyToken + `usersTable` lookup) |
| `src/lib/storage/supabase.ts` | lib | `supabaseStorageProvider: StorageProvider` (+ timing/metrics) |

Pino sink follows the same shape: `src/infra/pino/sink.ts` (`makePinoSink(logger)`) ← `src/lib/observability/pino-sink.ts` (binds project `logger` to `MetricsSink`).

## Add a new 3rd-party integration

1. Write the generic wrapper in `src/infra/<vendor>/` — a `make*` factory taking config + clients as args. Import only the SDK + other `@/infra/*`.
2. Put the domain interface (the "port") in `src/lib/<domain>/provider.ts` if one doesn't exist.
3. Write the re-wrap in `src/lib/<domain>/<vendor>.ts` — import the infra factory + `env`/`db`/interface, produce the bound instance.
4. Wire the instance at the single setup point (`src/server.ts` / `api/index.ts`).
5. `pnpm exec tsc --noEmit` + `pnpm exec eslint src api` (the infra rule must stay green) + `pnpm test`.

Do **not** add a `core/` layer; portable mechanisms go in `infra/`, project policy/config stays in `lib/`.
