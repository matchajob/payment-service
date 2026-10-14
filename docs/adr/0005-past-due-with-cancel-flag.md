# ADR 0005: `past_due` with `cancelAtPeriodEnd` is unreachable, and the schema says so

**Status:** Accepted, 2026-10-14
**Slice:** 3

## Context

PRD open question 4 asks what happens to a `past_due` subscription that also carries the `cancelAtPeriodEnd` flag. Spec 1 says the flag "rides on `active` or `past_due`", and PRD section 2.2 assumed a successful retry lands in `active` plus flag. Two behaviours were on the table:

- a. Retry as normal, land in `active` plus flag, cancel at the next renewal. The customer who asked to cancel is charged for a period they then cancel out of.
- b. Skip dunning and cancel immediately.

Reading the transition table row by row shows the question has no instance. There are two ways to enter `past_due` and one way to set the flag:

- Row 6 enters `past_due` from `active` on a failed renewal charge. But row 7 says a flagged `active` row is canceled at renewal with no charge, so a flagged row never attempts the charge that row 6 needs to fail.
- Row 14 can leave a row in `past_due`, but it starts from `past_due`, so it cannot introduce the flag.
- Row 8 sets the flag, and it is defined on `active` only. Row 12 says `cancel` on `past_due` cancels immediately, so the flag is never set on a `past_due` row.

No sequence of listed transitions produces the pair.

## Decision

The pair is unreachable and the system says so in three places rather than defining a behaviour for it.

- The state machine in slice 3 has no rows for `past_due` plus flag. Its input type makes the flag meaningful only for `active`; a `past_due` input carries no flag.
- The `subscriptions` table in slice 4 carries a check constraint: `cancel_at_period_end = false OR status = 'active'`. A bug that tries to write the pair fails at the database, not silently.
- The PRD's section 2.2 assumption (a) is withdrawn, and Spec 1's phrase "rides on `active`/`past_due`" is read as "rides on `active`". The spec is not edited; this ADR is the correction of record.

## Consequences

- A customer who asked to cancel is never charged again. Row 7 guarantees it, and this ADR makes the guarantee visible as a constraint rather than an emergent property of the table.
- `past_due` plus `cancel` (row 12) is the only way a `past_due` customer stops dunning, and it is immediate. There is no "cancel at the end of the grace period" for a customer whose card is failing; the grace period is the dunning schedule itself.
- If a future provider or a future row ever makes the pair reachable, the check constraint fails first, and this ADR is where to start the discussion.
- Slice 3's exhaustiveness test counts `past_due` plus flag as an absent pair that must be rejected, the same as any other absent pair.
