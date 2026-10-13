# Spec 5 — Outbox Delivery

Covers outbound events from payments-service to tenant apps (the `subscription_status` mirror feed). Event kinds: `subscription.activated`, `subscription.past_due`, `subscription.canceled`, `charge.succeeded`, `charge.failed`.

## Rules

| # | Rule |
|---|---|
| 1 | The outbox row commits in the same transaction as the state change it describes; no state change exists without its event |
| 2 | Delivery is at-least-once: drainer cron claims pending events (`FOR UPDATE SKIP LOCKED`), POSTs to the tenant `webhookUrl`, marks delivered on 2xx, retries with exponential backoff otherwise |
| 3 | Fat events (D12): each event carries a full subscription snapshot (status, `entitled`, `currentPeriodEnd`, plan ref) plus a per-subscription sequence number |
| 4 | Receivers apply a snapshot only if its sequence exceeds the stored one; stale or duplicate arrivals are no-ops keyed by event id — order of arrival never matters |
| 5 | Signing: HMAC-SHA256 over `timestamp.body` with the per-tenant webhook secret (`Payments-Signature` + `Payments-Timestamp` headers) |
| 6 | Dead-letter after 8 failed attempts: retries stop, last error retained, row stays queryable |
| 7 | Dead-letter handling v1 (D13): manual redrive script re-queues after the receiver is fixed; loud in logs, no automated paging |

## Receiver contract (implemented in each tenant app)

- Verify HMAC; reject timestamps older than 5 minutes.
- Respond 2xx before heavy processing: ack fast, process after.
- Dedup by event id; upsert the mirror by sequence (rule 4).
- Never call back into payments-service to interpret an event — the snapshot is the data.

## Decision log

- **D12** fat events with per-subscription sequence: delivery is the data, apps stay independent of service uptime, out-of-order arrivals are structurally harmless. Thin notify-and-fetch rejected: reintroduces runtime coupling the mirror architecture exists to remove.
- **D13** dead-letter = keep + manual redrive in v1; alerting deferred until an ops surface exists.
