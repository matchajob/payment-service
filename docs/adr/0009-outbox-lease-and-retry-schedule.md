# ADR 0009: The outbox drainer leases events, and retries on the Svix schedule

**Status:** Accepted, 2026-10-15
**Slice:** 6

## Context

Spec 5 rule 2 says the drainer claims pending events with `FOR UPDATE SKIP LOCKED`, POSTs them to the tenant, marks them delivered on 2xx, and retries with exponential backoff. Rule 6 dead-letters after 8 failed attempts. Two things are left open: whether the row lock is held while the POST is in flight, and what "exponential backoff" means in numbers.

### Lock across the POST, or lease

- **A. Hold the lock.** One transaction per event: lock the row, POST, record the result, commit. A crash rolls back to pending on its own. But the `attempts + 1` rolls back with it. A payload that crashes the process is never counted, never reaches 8, and retries forever, which breaks rule 6. It also pins a pool connection for the length of every POST, in the same process that serves the API. And it is fragile under `idle_in_transaction_session_timeout`, which managed poolers often set.
- **B. Lease.** The claim transaction locks due rows with `SKIP LOCKED`, sets `attempts + 1` and `nextAttemptAt = now + LEASE`, and commits. The POST runs with no transaction open. A second transaction records the result. A crash leaves the row pending, and it becomes due again when the lease runs out, with the attempt already counted.

B is the model AWS SQS uses: the visibility timeout is the lease, `ApproximateReceiveCount` increments when a message is handed out, not when the work finishes, and `maxReceiveCount` moves the message to a dead-letter queue.

### Retry schedule

- Stripe retries live-mode webhooks for up to 3 days and doesn't publish the delays.
- Svix makes 8 attempts: immediately, then after 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h. That's about 27.5 hours from the first try to giving up.
- AWS SNS caps HTTP retries at 1 hour in total. It's built for endpoints the subscriber operates, with SQS as the buffer for longer outages. Our receivers are other companies' servers, so that window is too short.

## Decision

**B, with a fence. Svix's schedule.**

- **Claim.** `UPDATE ... SET attempts = attempts + 1, next_attempt_at = now + LEASE WHERE outbox_event_id IN (SELECT ... WHERE delivery_status = 'pending' AND next_attempt_at <= now ORDER BY next_attempt_at LIMIT batch FOR UPDATE SKIP LOCKED) RETURNING *`. One statement, committed before any POST.
- **`nextAttemptAt` carries both "due" and "in flight".** A claimed row has `nextAttemptAt` in the future, so no other drainer sees it as due. No separate lease column is needed.
- **`LEASE` is longer than the HTTP timeout.** Otherwise a slow but healthy POST is claimed again while it is still running. This is the SQS pitfall of a visibility timeout shorter than the processing time.
- **The fence.** The result is written with `WHERE outbox_event_id = $id AND attempts = $claimedAttempts`. If the lease expired and another drainer claimed the row again, `attempts` has moved on and the late result changes nothing. Duplicate deliveries are already harmless to the receiver (rule 4). The fence protects our own bookkeeping, so that a late "failed" never flips a delivered row back to pending.
- **Dead letter.** A failure on attempt 8 sets `dead` and keeps `lastError`. A row whose 8th lease expired without a result is dead-lettered at the next claim, so the 9th attempt never happens.
- **The schedule** is a named table of 7 delays, not a formula: 5 s, 5 min, 30 min, 2 h, 5 h, 10 h, 10 h. `MAX_DELIVERY_ATTEMPTS` is derived from it as 8. That's roughly exponential, not strictly 2ⁿ. This ADR is how rule 2's "exponential backoff" should be read.
- **Success is 2xx only.** Redirects are not followed (`redirect: 'manual'`), so a signed payload is never forwarded to a host the tenant didn't register. A 3xx, any other non-2xx, a network error or a timeout is a failed attempt. `lastError` is a short description such as `HTTP 503` or `timeout`, never the response body.
- **No ordering per subscription.** Events are claimed by `nextAttemptAt` only. Rule 4 makes arrival order harmless, so a failing event never holds up the events after it.

## Consequences

- No database connection is held across network I/O. A slow tenant costs HTTP sockets, not pool connections.
- A crash mid-POST delays that event by up to one `LEASE`. It's still delivered, and still counted.
- The drainer runs on a schedule (ADR 0002), so the 5 s retry really happens at the next tick. Tests assert the stored `nextAttemptAt`, not wall-clock behaviour.
- Delivery is at-least-once in two places: a POST that succeeded but whose result write failed, and a lease that expired under a POST that eventually succeeded. Both are absorbed by the receiver's dedup by event id.
- Redrive (rule 7) resets a dead row to `pending`, `attempts = 0`, due now. The `lastError` from the dead attempt is cleared with it, because a redriven row is a fresh delivery.
