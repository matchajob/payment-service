# Restore runbook and drill

Cloud SQL keeps 14 daily backups (01:00 UTC) and point-in-time recovery, declared in `iac/database.ts`. A restore never overwrites the live instance. It clones into a new instance, and the service is switched over by changing the `database-url` secret.

## Restore to a point in time

```sh
PROJECT=<gcp-project> REGION=me-west1
TARGET=payment-service-restore-$(date +%Y%m%d%H%M)
POINT=2026-11-17T09:00:00Z   # just before the damage, UTC

gcloud sql instances clone payment-service "$TARGET" --project "$PROJECT" --point-in-time "$POINT"
```

1. Check the clone with `gcloud sql connect "$TARGET" --user payment_service --database payment_service --project "$PROJECT"`. Compare row counts and the newest `charges.attempted_at` against what you expect.
2. Stop the crons so nothing charges during the switch: `gcloud scheduler jobs pause <job> --location "$REGION"` for every job in `iac/cron-jobs.ts`.
3. Point the service at the clone: add a new `database-url` version with the clone's connection name (the same format as the ADR 0012 bootstrap), and add the clone to the service's and the migrate job's Cloud SQL volume. Today that means pointing the `databaseInstance` in `iac/database.ts` at it, or importing the clone into the stack.
4. Deploy a new revision, then check that `/health` answers and one cron run returns its counts.
5. Resume the Scheduler jobs. Reconcile asks the provider by dedup key about every charge row still pending in the clone, so those settle on their own.
6. Keep the old instance until the clone has been live for a week, then delete it by hand. Deletion protection is on, so this takes two steps on purpose.

Charges taken after `POINT` exist at the provider but not in the restored database. Reconcile finds them only for rows that exist. For the gap, pull the provider's transaction list for the window and compare it by hand.

## Drill, every quarter and before the first live client

1. Clone staging to a point an hour ago, as above.
2. Run `node --import tsx src/cli/migrate.ts` against the clone (it should do nothing) and compare table row counts with staging.
3. Record the date, how long the clone took, and anything that didn't match. Then delete the clone.
