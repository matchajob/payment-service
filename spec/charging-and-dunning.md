# Spec 2 — Charging & Dunning

Companion to [subscription-lifecycle.md](subscription-lifecycle.md); governs rows 5–7, 10–11, 14. Applies to `scheduleOwner: self` only — external (store-billed) subscriptions observe the store's own schedule.

## Period anchoring

- Period 1 starts at activation (row 2). Renewal is anniversary-based: activated on the 14th → bills every 14th.
- Month-length clamp: the anchor day persists even when clamped. Activated Jan 31 → Feb 28 → Mar 31.
- All timestamps UTC.

## Due detection

- Daily cron. Due = `active` + `currentPeriodEnd` in the past.
- Charge at expiry, never before. No pre-billing.
- The subscription stays `active` while the attempt runs; it flips to `past_due` only on a known failure. Cron lag never interrupts entitlement.

## Period advancement

- On success: `newPeriodEnd = oldPeriodEnd + interval` — never `now + interval`. Anniversaries are fixed; cron lag is not credited to the customer.

## Retry arithmetic

- The renewal is attempt 0; dunning retries are attempts 1..N per the tenant's `dunningSchedule`, offsets counted from the failed attempt 0.
- A retry fires on the first cron pass after its due moment; day-level precision is the contract.
- Exhausting the schedule → `canceled` (lifecycle row 11).

## Recovery period (D7)

- A rescue during grace (rows 10/14) pays for the period that failed: the new period runs from the original `periodEnd`, not the recovery date. Grace days are covered, and the anniversary never shifts.

## Charge amount (D8)

- Plans are immutable. A charge always uses the amount on the subscription's plan row.
- Price change = new plan row; existing subscribers stay on their row until the tenant explicitly migrates them. Live subscribers can never be repriced by an UPDATE.

## Failure handling (v1)

- All failures are treated alike: full dunning schedule regardless of decline kind.
- The provider's raw failure reason is stored per charge; hard-decline short-circuiting is an explicit deferral, not an oversight.

## Out of scope (v1)

Plan upgrades/downgrades, proration, trials, multi-currency per tenant.

## Decision log

- **D7** recovered subscriptions bill from the original `periodEnd`: continuous coverage, fixed anniversary.
- **D8** plans immutable; repricing is migration, not mutation.
