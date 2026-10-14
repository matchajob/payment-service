# ADR 0003: Integration tests run on a real local Postgres, rolled back per test

**Status:** Accepted, 2026-10-14
**Slice:** 0.0

## Context

Most of what this service guarantees is a database property: one succeeded charge per period, one subscription row per idempotency key, one delivery per outbox event. Those guarantees come from row locks, partial unique indexes, and `FOR UPDATE SKIP LOCKED`. None of them exist in an in-memory fake. Integration tests therefore need Postgres, the same major version as production.

Two questions: how tests get a database, and how tests get a clean one.

Getting a database:

1. **Local Postgres via docker compose**, one container, one database per purpose. Migrations are applied once per test run. CI starts the same container.
2. **Per-test-file database** created on the fly. Perfect isolation, but every file pays for a migration run, and the count of files grows with every slice.

Getting a clean one:

- a. **Transaction per test, rolled back.** The test opens a transaction, hands the transaction handle to the code under test, and rolls back in `afterEach`. Fast, and no test can leak rows into another.
- b. **Truncate between tests.** Real commits, so behaviour that depends on a commit being visible to another connection is testable. Slower, and a test that forgets its cleanup pollutes its neighbours.

## Decision

Option 1 for the database. Mode a by default, mode b for the suites that need real commits.

- `docker-compose.yml` runs Postgres on port `54329` with databases `payment_service` for `pnpm dev` and `payment_service_test` for tests. The port is chosen not to collide with a system Postgres on `5432` or a Supabase local stack on `54322`.
- A vitest global setup for the `integration` project applies migrations once per run against `TEST_DATABASE_URL`.
- The rollback helper in slice 0.4 is the default. Code under test receives its `db` handle as a parameter, never from a module-level singleton, which is what makes the rollback possible. When code under test opens its own transaction, Drizzle turns it into a savepoint inside the test's transaction, so nested commits do not escape.
- Suites that need visibility across connections, starting with the outbox drainer in slice 6, run in truncate mode. They use a separate helper that truncates every table in `afterEach`, and vitest runs them in a single worker so two truncating files do not interleave.

## Consequences

- A test that passes in rollback mode and fails in truncate mode has found a real bug, usually a missing commit boundary. The reverse means a test depends on uncommitted state that production would never see.
- Rollback mode cannot test `FOR UPDATE SKIP LOCKED`, because a second connection cannot see rows the first has not committed. That is why the outbox suite is truncate mode and not a reason to make everything truncate mode.
- A module-level `db` singleton is forbidden in `src/lib` and `src/api`. The handle is constructed once in the composition root and passed down. No eslint rule enforces this yet; the `matcha-conventions` audit and code review catch it until one does.
- Unit tests never touch the database. They live in the `unit` vitest project and run without docker. A pure module that needs Postgres to be tested is in the wrong directory.
- The same compose file serves `pnpm dev`, so local development and tests never disagree about the Postgres major version.
