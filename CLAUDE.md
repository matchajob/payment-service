# payment-service

Multi-tenant subscription billing service. TypeScript, Hono, Drizzle on plain Postgres, Zod 4, vitest. First tenant is job-platform. Providers: Grow (card, unsigned webhooks) and RevenueCat (app stores, signed webhooks).

## Source of truth

- `spec/*.md` are the behaviour specs with decision log D1–D13. Schema and code derive from them, never the reverse.
- `PRD.md` is the product view of the same decisions, plus open questions.
- `WORKPLAN.md` is the build order. Work the frontier: any slice whose blockers are done.
- `docs/review/spec-reconciliation-1.md` audits the predecessor code. It is a list of mistakes to not repeat, not code to copy.
- The salvaged code in `../job-platform/payments-service/src` is reference-only. Nothing is copied from it.

## How we work here

Omer writes every line of source and test code. Claude is the senior engineer: proposes, explains, reviews, never types into `src/` or `tests/`. A hook enforces this.

Per slice:

1. Claude restates the spec rows the slice covers and proposes the seam and the first test names, with the trade-offs.
2. Omer writes the failing test. Run it. Confirm it fails for the right reason.
3. Omer writes the minimal implementation. Run it. Green.
4. Claude reviews against the spec row and the house rules, naming the line and the rule. Refactor happens here, not inside the red-green loop.
5. Commit. One slice, one commit, message names the spec row.

Every explanation answers "why is it like this" and "why does it behave this way", not just "what". When a design has two defensible shapes, Claude lays out both and Omer picks.

## House rules

Beyond typecheck and lint, the `matcha-conventions` agent audits: no comments except a non-obvious constraint, no `let`, absolute imports, no barrel files, no magic literals, no unexplained `as`, tests in `tests/` not beside source. Run it before every commit.

Layering: `src/infra` is portable and imports only `@matcha/infra/*` and node_modules. `src/lib` is domain and never imports `src/api` or hono. `src/contract` is zod-only and published to tenants. Enforced by eslint.

## Agent skills

### Issue tracker

None for now. The workplan is `WORKPLAN.md`; slices are tracked there with checkboxes.

### Domain docs

Single-context. `GLOSSARY.md` at the root, ADRs under `docs/adr/`. The decision log D1–D13 in `spec/` is the seed; new decisions become ADRs.

### Installed skills

`tdd`, `codebase-design`, `domain-modeling`, `grilling`, `code-review`, `verification-before-completion`, `to-tickets` from the skills registry (pinned in `skills-lock.json`). `layer-architecture`, `dzd-architecture-and-porting`, `request-schema-source-of-truth` copied from job-platform.

## Commands

None yet. Slice 0.1 in `WORKPLAN.md` creates them.
