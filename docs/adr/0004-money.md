# ADR 0004: Money is an integer count of minor units plus a currency code

**Status:** Accepted, 2026-10-14
**Slice:** 0.0

## Context

Plans carry a price, charges record an amount, and the renewal cron sends that amount to a provider. The spec (D8, webhook-trust rule 2) says an amount always comes from our plan row and never from a payload, so the representation we store is the representation that gets charged. Getting it wrong is not a display bug.

Three options:

1. **Integer minor units and a currency enum.** `amountMinor: 1990` and `currency: 'ILS'` means 19.90 ILS. Postgres `integer`, TypeScript `number` constrained to a safe integer, zod `z.int()`.
2. **Decimal string.** `'19.90'` with Postgres `numeric(12,2)`. Exact, but every arithmetic step needs a decimal library, and `numeric` comes back from the driver as a string that is easy to accidentally `Number()`.
3. **Floating point.** `19.9` as `double precision`. Rejected on sight: `0.1 + 0.2` is the whole argument.

A separate question is whether currency is a free string or an enum. v1 is ILS only (PRD, out of scope: multi-currency per tenant).

## Decision

Option 1. Currency is a closed enum containing only `ILS`.

- Every money column is named `amountMinor` and typed `integer`, never `numeric`, never `real`. The name carries the unit so that a reader never has to guess whether `1990` is shekels or agorot.
- The zod side is a single `moneySchema` in `src/contract` with `amountMinor: z.int().positive()` and `currency: z.enum(['ILS'])`. Every amount in the API and in outbox payloads goes through it.
- Currency is a Postgres enum type with one value. Adding a currency is a migration that adds a value, a zod change that adds a literal, and a TypeScript compile error wherever an exhaustive switch forgets it. A free string would make the first non-ILS row a silent data event rather than a code change.
- No arithmetic on money exists in v1. There is no proration and no multi-line invoice. The amount on the plan row is the amount charged, unchanged. If arithmetic ever appears, it is integer arithmetic on minor units and it rounds explicitly.

## Consequences

- Postgres `integer` tops out at about 2.1 billion agorot, roughly 21 million ILS. No plan will reach that. If a reporting query ever sums charges, it casts to `bigint` first.
- The API never returns a formatted string such as `'₪19.90'`. Formatting is the tenant's job, and tenants have locales.
- Provider adapters translate at the edge. Grow and RevenueCat each have their own amount representation, and the adapter in `src/lib/payments` converts from minor units on the way out and ignores amounts on the way in, per webhook-trust rule 2.
- A `number` in TypeScript can hold `19.9`. The zod schema is what rejects it at the API boundary, and the Postgres column type rejects it at the storage boundary. Both are needed; the type system alone cannot express "integer".

## Amendment, 2026-10-14

The `currency` enum in `src/lib/money/currency.ts` carries `USD` as well as `ILS`, by Omer's decision during slice 1.2. Nothing charges in USD yet: Grow is configured for ILS, and the multi-currency non-goal in the PRD still stands. Before any plan is created with `USD`, the Grow adapter (slice 13) must either support it or reject it explicitly, so a USD plan cannot reach a renewal charge that Grow will refuse.
