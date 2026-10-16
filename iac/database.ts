import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import { PRODUCTION } from '@iac/environments';
import type { StackSettings } from '@iac/stack-settings';

const INSTANCE_NAME = 'payment-service';
const DATABASE_NAME = 'payment_service';
const POSTGRES_VERSION = 'POSTGRES_17';
const BACKUP_RETAINED_COUNT = 14;
const LOG_RETENTION_DAYS = 7;
const BACKUP_START_TIME_UTC = '01:00';

export const declareDatabase = (settings: StackSettings, opts: pulumi.CustomResourceOptions) => {
  const instance = new gcp.sql.DatabaseInstance(
    INSTANCE_NAME,
    {
      project: settings.project,
      region: settings.region,
      name: INSTANCE_NAME,
      databaseVersion: POSTGRES_VERSION,
      deletionProtection: true,
      settings: {
        // Postgres 16+ defaults to Enterprise Plus, which rejects shared-core tiers like db-f1-micro.
        edition: 'ENTERPRISE',
        tier: settings.databaseTier,
        availabilityType: settings.environment === PRODUCTION ? 'REGIONAL' : 'ZONAL',
        deletionProtectionEnabled: true,
        backupConfiguration: {
          enabled: true,
          startTime: BACKUP_START_TIME_UTC,
          pointInTimeRecoveryEnabled: true,
          transactionLogRetentionDays: LOG_RETENTION_DAYS,
          backupRetentionSettings: { retainedBackups: BACKUP_RETAINED_COUNT },
        },
        ipConfiguration: { ipv4Enabled: true, sslMode: 'ENCRYPTED_ONLY' },
        insightsConfig: { queryInsightsEnabled: true },
      },
    },
    { ...opts, protect: true },
  );
  const database = new gcp.sql.Database(
    DATABASE_NAME,
    { project: settings.project, instance: instance.name, name: DATABASE_NAME },
    { ...opts, protect: true },
  );
  return { instance, database };
};
