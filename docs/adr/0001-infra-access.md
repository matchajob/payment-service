# ADR 0001: How this repo consumes `@matcha/infra`

**Status:** Accepted, 2026-10-13
**Slice:** 0.0

## Context

The DZD layer and its neighbours (`domain-zod`, `domain-drizzle`, `domain-ef`, `validations`, `ts-utils`, `postgres`, `pino`, `http`) live in the job-platform repo under `src/infra` and are published nowhere. Infra files import each other as `@matcha/infra/<zone>/<file>`, so whatever mechanism we use must make that specifier resolve to the same tree.

Three options:

1. **Pinned git dependency.** `package.json` points at `github:leomerl/job-platform#<sha>&path:src/infra`. pnpm clones the subdirectory into `node_modules/@matcha/infra`. Works anywhere the SSH key works, including CI with a deploy key. Bumping is a deliberate SHA change in one line.
2. **tsconfig path to `../job-platform/src/infra`.** Zero install, always the live tree. Only works when both checkouts are siblings. Breaks in CI, in a fresh clone, and silently tracks uncommitted edits to infra.
3. **pnpm workspace or published package.** Clean, but requires either moving this repo into job-platform or publishing infra to a registry. Neither matches the goal of a standalone repo.

## Decision

Option 1. The SHA is pinned, never a branch. Bumping it is a reviewed change with a one-line note of what moved.

## Consequences

- Peer dependencies that the server zones import (`zod`, `drizzle-orm`, `postgres`, `pino`) are installed here at the ranges infra declares, so there is one zod and one drizzle instance.
- The React Native zones of infra are present on disk but never imported. The eslint layer rule in slice 0.1 enforces that.
- `tsconfig.json` keeps a `paths` entry for `@matcha/infra/*` pointing into `node_modules/@matcha/infra/*`. The package's `exports` map is `"./*": "./*"` with no file extensions, and TypeScript does not probe extensions through `exports`, so `paths` is what makes bare specifiers resolve to `.ts` files.
- Infra ships as TypeScript source, with three `enum` declarations in `validations/`, so Node cannot run it with type stripping. `tsx` and vitest transpile it. The vitest config must inline the package rather than externalize it.
- A change to infra that this repo needs happens in job-platform first, then a SHA bump here. Infra does not fork.
