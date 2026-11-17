import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import { SERVICE_NAME } from '@iac/cloud-run-service';
import { cloudSqlVolumeMounts, cloudSqlVolumes } from '@iac/cloudsql-volume';
import { PRODUCTION } from '@iac/environments';
import { MIGRATE_COMMAND } from '@iac/migrate-command';
import type { declareRuntimeSecrets } from '@iac/runtime-secrets';
import { secretEnvVars } from '@iac/secret-env-vars';
import type { StackSettings } from '@iac/stack-settings';

const MIGRATE_JOB_SUFFIX = 'migrate';

export const MIGRATE_JOB_NAME = `${SERVICE_NAME}-${MIGRATE_JOB_SUFFIX}`;

const SINGLE_TASK = 1;
const NO_RETRIES = 0;
const MIGRATE_TIMEOUT = '600s';

type MigrateJobArgs = {
  settings: StackSettings;
  runtime: gcp.serviceaccount.Account;
  databaseConnectionName: pulumi.Output<string>;
  secrets: ReturnType<typeof declareRuntimeSecrets>;
};

export const declareMigrateJob = (args: MigrateJobArgs, opts: pulumi.CustomResourceOptions) =>
  new gcp.cloudrunv2.Job(
    MIGRATE_JOB_NAME,
    {
      project: args.settings.project,
      location: args.settings.region,
      name: MIGRATE_JOB_NAME,
      deletionProtection: args.settings.environment === PRODUCTION,
      template: {
        taskCount: SINGLE_TASK,
        template: {
          serviceAccount: args.runtime.email,
          maxRetries: NO_RETRIES,
          timeout: MIGRATE_TIMEOUT,
          volumes: cloudSqlVolumes(args.databaseConnectionName),
          containers: [
            {
              image: args.settings.image,
              commands: [...MIGRATE_COMMAND],
              volumeMounts: cloudSqlVolumeMounts(),
              envs: secretEnvVars(args.secrets),
            },
          ],
        },
      },
    },
    opts,
  );
