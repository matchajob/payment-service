import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import { ENV } from '@/lib/env-names';
import { cloudSqlVolumeMounts, cloudSqlVolumes } from '@iac/cloudsql-volume';
import { PRODUCTION } from '@iac/environments';
import { REQUEST_TIMEOUT } from '@iac/request-timeout';
import type { StackSettings } from '@iac/stack-settings';
import type { declareRuntimeSecrets } from '@iac/runtime-secrets';
import { secretEnvVars } from '@iac/secret-env-vars';

export const SERVICE_NAME = 'payment-service';

const CONTAINER_PORT = 8080;
const HEALTH_PATH = '/health';
const LOG_LEVEL = 'info';
const MIN_INSTANCES = 0;

type CloudRunServiceArgs = {
  settings: StackSettings;
  runtime: gcp.serviceaccount.Account;
  cronInvoker: gcp.serviceaccount.Account;
  cronAudience: string;
  databaseConnectionName: pulumi.Output<string>;
  secrets: ReturnType<typeof declareRuntimeSecrets>;
  providerCredentialsKeyId: pulumi.Output<string>;
};

export const declareCloudRunService = (args: CloudRunServiceArgs, opts: pulumi.CustomResourceOptions) => {
  const { settings } = args;
  return new gcp.cloudrunv2.Service(
    SERVICE_NAME,
    {
      project: settings.project,
      location: settings.region,
      name: SERVICE_NAME,
      ingress: 'INGRESS_TRAFFIC_ALL',
      // Tenants authenticate with API keys and Grow's webhooks carry no Google identity, so Cloud Run IAM cannot gate requests.
      invokerIamDisabled: true,
      deletionProtection: settings.environment === PRODUCTION,
      template: {
        serviceAccount: args.runtime.email,
        timeout: REQUEST_TIMEOUT,
        scaling: { minInstanceCount: MIN_INSTANCES, maxInstanceCount: settings.maxInstances },
        volumes: cloudSqlVolumes(args.databaseConnectionName),
        containers: [
          {
            image: settings.image,
            ports: { containerPort: CONTAINER_PORT },
            volumeMounts: cloudSqlVolumeMounts(),
            startupProbe: { httpGet: { path: HEALTH_PATH } },
            envs: [
              { name: ENV.LOG_LEVEL, value: LOG_LEVEL },
              { name: ENV.CRON_INVOKER_EMAIL, value: args.cronInvoker.email },
              { name: ENV.CRON_AUDIENCE, value: args.cronAudience },
              { name: ENV.PROVIDER_CREDENTIALS_KMS_KEY, value: args.providerCredentialsKeyId },
              { name: ENV.PUBLIC_BASE_URL, value: settings.publicBaseUrl },
              { name: ENV.GROW_BASE_URL, value: settings.growBaseUrl },
              ...secretEnvVars(args.secrets),
            ],
          },
        ],
      },
    },
    opts,
  );
};
