# ADR 0023: Billing dates are computed in the tenant's time zone

**Status:** Accepted, 2026-11-05
**Amends:** Spec 2 "Period anchoring" ("All timestamps UTC" now covers storage only). The spec isn't edited; this ADR is the correction of record.
**Fixes:** code-review-1 N12.

## Context

The anchor day and each period end were computed from UTC calendar fields. For a tenant in Israel:

- Activating at 00:30 local time on the 1st happens on the 30th or 31st in UTC, so the customer was anchored on the 30th or 31st and clamped in short months.
- The local billing hour moved by an hour at each daylight-saving change, because the UTC hour was kept and the local one was not.

Once anchors are stored, changing the rule moves every customer's billing date, so it had to be settled before the first real activation.

Options were UTC everywhere (document the drift), a fixed `Asia/Jerusalem`, or a zone per tenant. A fixed zone bakes one market into an engine meant to be sold beyond it.

## Decision

1. `tenants.time_zone` holds an IANA zone name. It is declared in the DZD entity through `makeDzdTimeZone`: the zod side refuses a name `Intl` doesn't know, and the column has a `UTC` default only so that existing rows backfill to today's behaviour. `createTenant` and the seed CLI (`--time-zone`) require it explicitly.
2. `startPeriod` takes the anchor day from the local calendar date of the activation instant. `advancePeriod` reads the previous end's local wall clock, advances the local month, clamps the day to that local month's length, and converts the local wall time back to an instant. The local billing hour therefore stays fixed across DST.
3. Timestamps are still stored and compared as UTC instants. Only calendar arithmetic uses the zone.

## Consequences

- A tenant on `UTC` gets exactly the old results; every existing test runs on `UTC` fixtures unchanged.
- A local wall time that doesn't exist (inside a spring-forward gap) resolves to an instant an hour away. Only a billing hour inside the gap is affected, and the anchor day is kept.
- Changing a tenant's zone after it has subscribers shifts their next period ends. There is no tool for that today, and there shouldn't be one without a migration plan.
- Recovered subscriptions keep billing from the original period end (D7). That calculation goes through the same zone-aware `advancePeriod`.
