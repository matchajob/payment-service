# ADR 0008: A charge commits a `pending` intent row before the provider is called

**Status:** Accepted, 2026-10-16
**Slice:** 5 (charge #1); applies equally to slice 8 (renewal), 10 (dunning) and 11 (row 14 retry)

## Context

Spec 1's double-charge guards say charge execution "runs in a transaction holding the subscription row lock" and re-verifies before contacting the provider. Read literally, that is one transaction: lock, re-verify, call the provider, record the result, commit.

During the slice 5 schema review, Omer asked what happens when a second charge really does happen. With the single-transaction shape, the answer is bad. The record of the charge is written after the money moves, in a transaction that can still roll back. If that final insert fails, whether from a constraint, a crash or a dropped connection, the rollback erases the only record of a charge that happened. A tripwire index that fires at that point destroys its own evidence.

The same shape also holds a row lock across a network call to the provider, which ADR 0006 already avoided for idempotency.

## Decision

Every charge goes through three steps, each committed separately:

1. **Intent (tx1).** Lock the subscription, re-verify state and that the period is unpaid, insert a `charges` row with status `pending`, and commit.
2. **Provider call.** No transaction is open. The call carries the dedup key `subscriptionId:periodEnd:attempt`.
3. **Outcome (tx2).** Update that same row to `succeeded` (with the provider's ref) or `failed` (with the provider's reason), apply the transition, write the outbox event, and commit.

Rules that follow from it:

- **The per-period guard counts `pending` too.** `charges_one_live_per_period` is a partial unique index over `(subscriptionId, periodEnd)` where status is `pending` or `succeeded`. A second attempt for a period can't be inserted in tx1, so the provider is never called twice. Failed attempts don't count, so dunning still works.
- **A timeout is not a failure.** If the provider call throws or answers without a definite outcome, the row stays `pending`. Writing `failed` would free the period through the index, and the next attempt could charge twice. Only a definite decline writes `failed`.
- **The write after the money moves can't be rejected by our own constraints.** It's an update of the only live row for the period, and the provider's answer satisfies the outcome checks. An empty decline reason is replaced with a named fallback before the update, because `failureReason` is non-empty.
- **A `pending` row is unresolved evidence, not lost evidence.** The nightly reconcile (Spec 4 rule 8, slice 12) settles it with the provider.

This ADR replaces Spec 1's "a transaction holding the subscription row lock" for charges. The spec isn't edited; this ADR is the correction of record, as ADR 0005 was. The re-verify step is unchanged. It now runs in tx1.

## Charge #1 specifically (with ADR 0007)

tx1 for the first charge also activates: it stores the payment method, moves the row from `incomplete` to `active` with period 1, and inserts the `pending` charge. The move to `active` is where `subscriptions_one_live_per_customer` decides between two paid checkouts, before any money moves.

- **Succeeded:** tx2 records the charge and emits `subscription.activated`. That's the first event the tenant ever sees for this subscription.
- **Declined (decided 2026-10-16, PRD open question 7):** tx2 records the failure, moves the row to `canceled`, and emits `charge.failed` with a `canceled` snapshot. We never retry that card, so keeping the row `incomplete` would serve nothing. The customer starts a new checkout.
- **Lost to the one-live index:** tx1 rolls back. A separate transaction cancels the row with no charge, and `subscription.canceled` is emitted.

## Consequences

- Between tx1 and tx2 the row is `active` without a settled payment. No event has been emitted yet, so the tenant's mirror doesn't show it as entitled. Our own `status` reads `active` for the length of the provider call, or until reconcile if the call timed out.
- A charge #1 timeout leaves an `active` row with a `pending` charge until reconcile settles it. Reconcile in slice 12 needs to look a charge up by our dedup key, because a row interrupted mid-call has no provider ref yet. Today `verifyCharge` takes the provider's ref, so that's a port change, to confirm against Grow in slice 13.
- The transition table gains three events for charge #1: `first_charge_succeeded`, `first_charge_failed` and `already_subscribed`. Row 2's `checkout_completed` no longer emits on its own.
- All four charge #1 rows are `selfOnly`, because we initiate the charge. Spec 1 says store notifications drive row 2 in external mode. v2 adds its own activation event for that case, which records an observed charge and initiates none, rather than reusing `checkout_completed`.
- Renewal (slice 8), dunning (slice 10) and the row 14 retry (slice 11) use the same three steps.
