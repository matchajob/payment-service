---
name: dzd-architecture-and-porting
description: Use when explaining what DZD is, understanding its architecture and benefits, learning how DZD entities flow into HTTP/API routes, or porting the DZD infrastructure (src/infra/dzd, ct-drizzle, ct-ef, ct-zod, validations, ts-utils) from the citytech project to another TypeScript project
---

# DZD: Architecture, HTTP Integration & Porting Guide

## Overview

**DZD** = **D**rizzle / **Z**od / **D**efinition.

A type-safe, declarative entity definition layer that **collapses three sources of truth into one**:
1. Zod validators (request/response validation)
2. Drizzle ORM column definitions (database schema)
3. TypeScript types (compile-time safety)

A single field declaration like `dzdTheme.str.email("email")` produces a validator that's used at the HTTP boundary AND a Postgres `varchar(64) UNIQUE` column AND inferred TS types — all guaranteed to agree.

## Why DZD Is Good (Design Rationale)

### The Problem It Solves

In typical TypeScript backends with Zod + an ORM, you end up writing the same field three times:

```typescript
// 1. Drizzle schema
email: varchar('email', { length: 64 }).notNull().unique(),

// 2. Zod create schema
const createSchema = z.object({ email: z.string().email().max(64), ... });

// 3. Zod read schema (different — has the generated id)
const readSchema = z.object({ id: z.string().uuid(), email: z.string().email().max(64), ... });
```

This causes **three classes of drift bugs**:
- DB allows 128 chars, Zod allows 64 → silent truncation or DB errors
- Field is `NOT NULL` in DB but Zod marks it `.optional()` → 500s in production
- Read schema includes `password_hash` because someone forgot to omit it → security leak

### How DZD Eliminates Drift

**One declaration → four schemas.** `entityFromDzd(dzdTheme.str.email("email"), { index: true })` returns:

```typescript
{
  read:   ZodString,              // for response validation
  create: ZodString,              // for POST body validation
  update: ZodOptional<ZodString>, // PATCH semantics: all fields optional
  delete: ZUndefinedNever,        // not part of delete payload
  db:     varchar('email', 64).notNull(),
  config: { index: true, unique: { nullsNotDistinct: true } },
  index:  true,
}
```

The four Zod schemas are **derived from a single Zod definition** plus config flags. The DB column comes from the same source. They cannot drift.

### job-platform current API (2026-07 rework)

This repo has diverged from citytech — port from HERE, not citytech:
- Layers renamed: `ct-drizzle`→`domain-drizzle`, `ct-zod`→`domain-zod`, `ct-ef`→`domain-ef`.
- **`defineEntity(tableName, builders, options?)`** (`src/infra/domain-ef/define-entity.ts`) is the single entity entry point — field names infer from object keys; no `FIELDS` const, no `dzdFieldEntry` spreads, no separate `deriveEntityZod`/`deriveEntityDb`/`pgTable` calls. Options: `extraConstraints`, `pgSchema`, `pairAllTo`.
- `unique: { distinctNulls }` renamed `unique: { nullsNotDistinct }` (name now matches Postgres semantics; SQL unchanged).
- New `hasDbDefault` config flag — set by column makers when the column carries a DB default; one `defaultValue` feeds both zod `.default()` and the DB column.
- **Fail-fast invariants at module load**: unbacked `isOptional` (no isNullable/hasDbDefault/generatedOnCreate) throws; missing primary key throws; errors are prefixed `dzd field "<name>": …`.
- Runtime test suites exist alongside the test-d type tests: `dzd-zod-config.test.ts`, `dz-helpers.test.ts`, `entity-from-dzd.test.ts`, `define-entity.test.ts`.
- **Branded uuid columns (2026-07)**: every `dzdThemeUuid.*` call (`primaryKey`, `primaryRef`, `requiredRef`, `optionalRef`, `optional`) and `makeDzdUuid` now take a required entity-brand argument, e.g. `dzdThemeUuid.primaryKey(f, 'UserId')`, `dzdThemeUuid.requiredRef(f, { ref, actions }, 'MatchId')`. The brand is a compile-time-only nominal marker (`Brand<T, TBrand>` in `src/infra/ts-utils/brand.ts`) so `tsc` rejects passing a `MatchId` where a `UserId` is expected — it's erased at runtime, no DB/wire change. It flows through both derived Zod output (`z-id.ts`'s `ZodBrandedUuid<TBrand>`) and the Drizzle column type (`drizzle-base-types.ts`'s `DzUuid<TBrand>` via `.$type<Brand<...>>()`), so raw `db.select()` results carry the brand too, not just `.parse()`'d values. Missing the brand argument on any uuid column is a `tsc` error, not a silent gap.

### The Operation-Aware Flag System

DZD's killer feature is that flags apply *differently* per CRUD operation. Example: `generatedOnCreate: true`:
- On **create** → field becomes `ZUndefinedNever` (client must NOT send it; DB generates)
- On **read** → required (DB always returns it)
- On **update** → optional (might or might not change)

This single flag correctly handles serial primary keys, `created_at` timestamps, and DB-generated UUIDs. The flag matrix (in `dzd-zod-config.ts`):

| Flag | Create | Read | Update |
|------|--------|------|--------|
| `isOptional` | optional | required | always optional |
| `isNullable` | nullable | nullable | nullable |
| `isReadonly` | **never** | required | **never** |
| `isImmutable` | required | required | **never** |
| `requiredOnUpdate` | required | required | required |
| `generatedOnCreate` | **never** | required | optional |
| `generatedOnUpdate` | required | required | **never** |
| `hideOnRead` | required | **never** | optional |
| `isPrimaryKey` | required | required | required (+ available on delete) |

### Why Three Layers (ct-drizzle, ct-zod, dzd)

The codebase splits concerns deliberately:

- **`ct-drizzle/`** — wraps Drizzle ORM with typed builders (`makeDzString`, `makeDzInteger`). Adds nothing semantic; just type-safe column constructors.
- **`ct-zod/`** — wraps Zod with i18n, OpenAPI integration, and a `ZUndefinedNever` type for "this field doesn't exist in this operation."
- **`dzd/`** — combines both via `DzdFieldSchema<TZod, TDb>`. This is where the "single source of truth" lives.
- **`ct-ef/`** — "entity framework". Aggregates field declarations into entity-level CRUD schemas + DB tables.

This layering makes the boundaries replaceable. You could swap Drizzle for Prisma by rewriting only `ct-drizzle/` and `dzd-*.ts` builders.

## How DZD Integrates with HTTP

The HTTP layer reuses DZD-generated Zod schemas to validate requests/responses. The flow:

```
                          ┌─ deriveEntityZod ──→ zUserCreate, zUserRead, zUserUpdate
DZD field declarations ──┤
                          └─ deriveEntityDb ───→ userTable (Drizzle)

API route config.ts:
  ┌────────────────────────────────────────────────┐
  │ const inputSchema = { query: z.object({...}) } │  ← uses Zod primitives
  │ const outputSchema = createListOutput(zUserRead) │ ← uses DZD-derived Zod
  │ export const cfg = createRouteConfig(input, output, minRole)│
  └────────────────────────────────────────────────┘

API route endpoints.ts:
  createHttpServerRouteWithAuth({ path, method, config: cfg, handler })

API route routines.ts (handler):
  async function handler(input: RoutineInputFromConfig<typeof cfg>) {
    const rows = await db.select().from(userTable).where(...)  ← uses DZD Drizzle table
    return { statusCode: 200, data: rows };  // validated against zUserRead
  }
```

### The Config-Endpoints-Routine Pattern

Every API route in `src/app/api/<entity>/` has three files:

**`config.ts`** — declarative request/response contract:
```typescript
import { zUserCreate, zUserRead } from "@/feature/entities/user-entity/user-entity";
import { zUuid, zEmail, zBoolean } from "@/infra/validations/...";

export const listUsersInputSchema = {
  query: z.object({
    userId: zUuid.optional(),
    email: zEmail.optional(),
    isArchived: zBoolean.default(false),
  }),
};

const { listOutputSchema } = createListOutput(zUserRead);  // wraps zUserRead in pagination envelope
export const listUsersConfigSchema = createRouteConfig(
  listUsersInputSchema,
  listOutputSchema,
  APP_ROLES.systemAdmin,  // min role for auth
);
```

**`endpoints.ts`** — wires config + handler with auth + OpenAPI:
```typescript
export const usersEndpointGET = createHttpServerRouteWithAuth({
  path: PATH,
  method: REST_METHODS.GET,
  config: listUsersConfigSchema,
  handler: usersRoutineGET,
  openApi: { summary, description, tags, operationId },
});
```

**`routine.ts`** — pure business logic with typed I/O:
```typescript
export async function usersRoutineGET(input: RoutineInputFromConfig<ListUsersConfig>) {
  const rows = await db.select().from(userTable).where(and(...));
  return { statusCode: REST_STATUS_CODES.OK, data: rows };
}
```

**`route.ts`** — Next.js handler (one-liner):
```typescript
export const GET = usersEndpointGET.nextRoute;
```

### Why This Works

- **Type safety end-to-end**: `RoutineInputFromConfig<typeof cfg>` infers exact input shape from the config Zod schemas.
- **No manual validation**: middleware validates request against `inputSchema` before `routine` runs.
- **No manual response shaping**: middleware validates response against `outputSchema` before sending.
- **OpenAPI docs**: `@asteasolutions/zod-to-openapi` traverses the config schemas to generate API docs automatically.
- **Single source of truth**: change a field's max length in the entity, and validation everywhere updates.

## How to Recreate DZD in Another Project

### Architecture Map (Bottom-Up Dependency Order)

Port these layers in order. Each depends only on the ones below it.

```
┌─────────────────────────────────────────────────────┐
│ src/feature/entities/      (your entities)          │
└─────────────────────────────────────────────────────┘
              ▲
┌─────────────────────────────────────────────────────┐
│ src/infra/api/             (HTTP routes — optional) │
└─────────────────────────────────────────────────────┘
              ▲
┌─────────────────────────────────────────────────────┐
│ src/infra/ct-ef/           (entity framework)       │
│   entity-from-dzd.ts, entity-definition.ts,         │
│   entity-definition-db.ts                           │
└─────────────────────────────────────────────────────┘
              ▲
┌─────────────────────────────────────────────────────┐
│ src/infra/dzd/             (DZD field types)        │
│   dzd-{string,integer,float,boolean,uuid,           │
│        timestamp,enum}.ts                           │
│   dzd-theme.ts, dzd-field-entry.ts,                 │
│   dzd-field-schema.ts, dzd-config.ts,               │
│   dzd-zod-config.ts, dzd-dz-config.ts,              │
│   enumUtils.ts                                      │
└─────────────────────────────────────────────────────┘
              ▲                              ▲
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ src/infra/ct-drizzle/       │  │ src/infra/ct-zod/           │
│  Drizzle column wrappers    │  │  Zod + OpenAPI + i18n       │
│  dz-{string,integer,...}.ts │  │  zod.ts, zod-never.ts,      │
│  dz-constraints.ts,         │  │  flatten-zod-errors.ts      │
│  dz-helpers.ts, exports.ts, │  │                             │
│  drizzle-base-types.ts      │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
              ▲                              ▲
┌─────────────────────────────────────────────────────┐
│ src/infra/validations/     (Zod primitives)         │
│   z-string, z-integer, z-float, z-boolean,          │
│   z-id (uuid), z-email, z-timestamp, z-sku,         │
│   z-{israeli-phone,national-id,picture,             │
│      password,hash,version}                         │
└─────────────────────────────────────────────────────┘
              ▲
┌─────────────────────────────────────────────────────┐
│ src/infra/ts-utils/        (TS type helpers)        │
│   merge-objs.ts, const-obj.ts, exact-keys.ts,       │
│   obj-required-fields.ts, configuration-types.ts,   │
│   unsafe-any.ts                                     │
└─────────────────────────────────────────────────────┘
```

### Porting Steps

1. **Set up the target project**:
   ```bash
   npm install drizzle-orm zod
   npm install -D drizzle-kit
   npm install @asteasolutions/zod-to-openapi zod-i18n-map
   ```
   Match the citytech `package.json` versions for `drizzle-orm` (^0.43.x) and `zod` (^3.25.x) to avoid API surface drift.

2. **Configure path aliases** in `tsconfig.json`:
   ```json
   { "paths": { "@/*": ["./src/*"] } }
   ```
   DZD relies on `@/infra/...` imports throughout.

3. **Copy in dependency order** (each layer is self-contained once layers below it are present):
   - [ ] `src/infra/ts-utils/` — pure TypeScript, no deps
   - [ ] `src/infra/validations/` — Zod primitives (depends on `ts-utils` + `zod`)
   - [ ] `src/infra/ct-zod/` — Zod wrapper (depends on `zod` + `validations`)
   - [ ] `src/infra/ct-drizzle/` — Drizzle wrapper (depends on `drizzle-orm` + `ct-zod`)
   - [ ] `src/infra/dzd/` — DZD core (depends on `ct-drizzle` + `ct-zod` + `validations`)
   - [ ] `src/infra/ct-ef/` — entity framework (depends on `dzd`)
   - [ ] `src/infra/api/` — HTTP layer (only if you want REST routes)

4. **Strip domain-specific validators** (citytech-specific):
   - Remove `z-israeli-phone.ts` and `z-national-id.ts` (Israel-specific)
   - Remove `dzdTheme.str.israeliPhoneNumber` / `israeliNationalId` from `dzd-string.ts`
   - Remove `appRoleEnum` references from `ct-zod` if present
   - Replace Hebrew i18n in `ct-zod/zod.ts` with your project's locale

5. **Decide on versioning** (audit log) support:
   - The codebase has `tgit-*` files implementing append-only audit tables via `createVersionedPair`. This is in `src/feature/entities/tgit/`, not `infra/`.
   - If you want it: port `tgit-utils/` and `tgit-main/`. They depend on `dzd` and `ct-ef`.
   - If you don't: skip; DZD works fine without versioning.

6. **Smoke test** by creating one entity:
   ```typescript
   import { defineEntity } from '@/infra/domain-ef/define-entity';
   import { entityFromDzd } from '@/infra/domain-ef/entity-from-dzd';
   import { dzdThemeUuid } from '@/infra/dzd/dzd-uuid';
   import { dzdThemeStr } from '@/infra/dzd/dzd-string';

   export const thingsEntity = defineEntity('things', {
     id:   (f) => entityFromDzd(dzdThemeUuid.primaryKey(f)),
     name: (f) => entityFromDzd(dzdThemeStr.nonEmpty.title(f)),
   });
   export const { read, create, update, table: thingsTable } = thingsEntity;
   ```
   If `read.parse({...})` validates AND `drizzle-kit generate` produces a migration with the right column types, the port is working.

### Pitfalls When Porting

| Pitfall | Why it happens | Fix |
|---------|----------------|-----|
| `as const satisfies Record<...>` errors | TS strict mode + `noUncheckedIndexedAccess` interactions | Match citytech's `tsconfig.json` strictness flags |
| Drizzle column types fail to infer | drizzle-orm version mismatch (API drifts between minor versions) | Pin to ^0.43.x or update `ct-drizzle` wrappers to the new API |
| `zUndefinedNever` not recognized | Custom Zod type defined in `ct-zod/zod-never.ts` | Make sure that file is ported — it's foundational |
| `ZodEnum` vs `ZodNativeEnum` confusion | `createEnumPair` builds both Zod and Drizzle enums from one source | Always use `createEnumPair`; never declare them separately |
| Path aliases broken | `@/infra/*` imports unresolved | Configure both `tsconfig.json` paths AND your bundler/build tool |
| OpenAPI generation broken | `zod-i18n-map` initializes Zod globally | Initialize early in app bootstrap; check for double-init |
| Versioning fields missing | `versionFieldName` and `createVersionedPair` are in `tgit/`, not `infra/dzd` | Port `tgit/` layer separately if you want audit logging |

## Quick Reference: What Each File Does

### `src/infra/dzd/` — The DZD core (14 files)

| File | Role |
|------|------|
| `dzd-field-schema.ts` | `DzdFieldSchema<TZod, TDb, TCheck, TConfig>` — the unified type combining Zod schema + Drizzle column |
| `dzd-config.ts` | `DzdFieldConfig = DzdZodConfig & DzFieldConfig` — merged config |
| `dzd-zod-config.ts` | Operation-aware Zod transforms (`withZodConfigForCreate/Read/Update`) — heart of the flag system |
| `dzd-dz-config.ts` | DB-side config (PK, unique, FK, index) + `applyDzConfig` |
| `dzd-field-entry.ts` | `dzdFieldEntry(name, builder)` — wraps a builder so you can spread `...dzdFieldEntry(...)` into entity defs |
| `dzd-theme.ts` | Aggregator — exposes all themes under `dzdTheme.{str,int,uuid,...}` |
| `dzd-{string,integer,float,boolean,uuid,timestamp,enum}.ts` | Per-type field constructors and named themes |
| `enumUtils.ts` | `createEnumPair(name, obj)` → `{ zod: ZodEnum, dz: PgEnum }` synced |

### `src/infra/ct-ef/` — Entity framework (3 files)

| File | Role |
|------|------|
| `entity-from-dzd.ts` | `entityFromDzd(schema, config?)` — runs the field through Zod transforms + DB config to produce `EntityFieldDef` |
| `entity-definition.ts` | `EntityFieldDef` interface + `deriveEntityZod(def)` → `{read, create, update, delete}` Zod objects |
| `entity-definition-db.ts` | `deriveEntityDb(def, {tableName})` → `{db, indexes, constraints, checks, ...}` for `pgTable` |

### `src/infra/ct-drizzle/` — Drizzle wrappers (12 files)

| File | Role |
|------|------|
| `drizzle-base-types.ts` | `AnyDzType`, `DzVarchar`, `DzInteger`, `DzBigSerial` — type aliases for Drizzle column types |
| `dz-{string,integer,float,boolean,uuid,timestamp}.ts` | `makeDz<Type>(name, config)` — column constructors with size/default config |
| `dz-constraints.ts` | `getDzPrimaryKey`, `getDzForeignKey`, `getDzUnique` — constraint builders |
| `dz-helpers.ts` | Snake-casing, qualified-name helpers, index/check name generators |
| `exports.ts` | Re-exports from `drizzle-orm` (`pgTable`, `sql`, `and`, `eq`, `foreignKey`, etc.) |
| `dz-create-db.ts` | `createDb()` — Drizzle client init |
| `cte.ts` | CTE query helpers (optional) |

### `src/infra/ct-zod/` — Zod wrappers (4 files)

| File | Role |
|------|------|
| `zod.ts` | Re-exports `zod`, sets up i18n, defines `createZodEnum` |
| `zod-never.ts` | `zUndefinedNever` / `ZUndefinedNever` — represents "this field is absent in this op" |
| `zod-logging.ts` | Debug helpers for Zod errors |
| `flatten-zod-errors.ts` | Formats Zod errors for client responses |

### `src/infra/validations/` — Zod primitives (~15 files)

`z-string`, `z-integer`, `z-float`, `z-boolean`, `z-id` (uuid), `z-email`, `z-timestamp`, `z-sku`, `z-password`, `z-hash`, `z-picture`, `z-version`, plus Israel-specific (`z-israeli-phone`, `z-national-id`) — strip what you don't need.

`z-id.ts` also exports one branded schema/type per entity (`zUserId`/`UserId`, `zMatchId`/`MatchId`, `zMessageId`/`MessageId`, `zTokenId`/`TokenId`, `zImageId`/`ImageId`, `zExperienceId`/`ExperienceId`, `zRoleId`/`RoleId`, `zRecordingId`/`RecordingId`, `zSessionId`/`SessionId`), built off the plain `zUuid` via `zId<TBrand>()`, plus a matching `asXxxId(raw)` constructor per entity for stamping a brand onto a value at a genuine trust boundary (URL param, CLI arg, optimistic UI placeholder) where nothing parsed it through a schema.

### `src/infra/ts-utils/` — TS helpers (7 files)

| File | Role |
|------|------|
| `merge-objs.ts` | `mergeObjects(a, b)` + `TMergedKeys<A, B>` — deep merge with type inference |
| `const-obj.ts` | `constObjFromKeys({ a: null, b: null })` → `{ a: 'a', b: 'b' } as const` |
| `exact-keys.ts` | Type-level "no extra keys" check |
| `obj-required-fields.ts` | Extract required/optional field names by type |
| `configuration-types.ts` | `undefinedableToBool` and similar normalizers |
| `unsafe-any.ts` | `UnsafeAny` — semantically marked `any` for documentation |
| `brand.ts` | `Brand<T, TBrand>` — plain-property nominal marker (not Zod's own `.brand()`, whose mapped-type `$brand` breaks generic composition through this exact DZD/Drizzle plumbing) + `makeBrandCtor<TBrand>()` |

## Key Insights to Remember

- **Single source of truth**: A DZD field declaration produces 4 Zod schemas + 1 Drizzle column. They cannot disagree.
- **Operation-aware flags**: `isReadonly`, `generatedOnCreate`, `isImmutable`, `isPrimaryKey` etc. apply differently per CRUD op (see flag matrix above).
- **HTTP integration is downstream**: The HTTP layer (`src/app/api/`) consumes DZD-generated `z<Entity>{Read,Create,Update}` Zod objects. DZD itself doesn't know about HTTP.
- **Layered architecture**: ct-drizzle and ct-zod are independent wrappers that DZD combines. Either could be replaced (e.g., swap Drizzle→Prisma) by rewriting one layer.
- **Versioning is opt-in**: Audit logs / versioned entities live in `feature/entities/tgit/`, not in `infra/dzd`. The base DZD system has no notion of versioning.
- **Domain-specific validators must be stripped**: Israeli-specific validators, Hebrew i18n, app role enums — extract these before porting.
