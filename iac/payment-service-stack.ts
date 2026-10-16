import * as pulumi from '@pulumi/pulumi';
import { declareArtifactRegistry } from '@iac/artifact-registry';
import { SERVICE_NAME, declareCloudRunService } from '@iac/cloud-run-service';
import { declareDatabase } from '@iac/database';
import { declareGithubDeployer } from '@iac/github-deployer';
import { declareProviderCredentialsKey } from '@iac/provider-credentials-key';
import { enableRequiredApis } from '@iac/enable-required-apis';
import { declareRuntimeSecrets } from '@iac/runtime-secrets';
import { declareSchedulerJobs } from '@iac/scheduler-jobs';
import { declareServiceAccounts } from '@iac/service-accounts';
import type { StackSettings } from '@iac/stack-settings';

const CRON_AUDIENCE_SUFFIX = 'cron';

export const declarePaymentServiceStack = (settings: StackSettings) => {
  const opts: pulumi.CustomResourceOptions = { dependsOn: enableRequiredApis(settings.project) };
  const cronAudience = `${SERVICE_NAME}-${settings.environment}-${CRON_AUDIENCE_SUFFIX}`;

  const registry = declareArtifactRegistry(settings, opts);
  const { runtime, cronInvoker } = declareServiceAccounts(settings, opts);
  const { instance } = declareDatabase(settings, opts);
  const secrets = declareRuntimeSecrets(settings, runtime, opts);
  const providerCredentialsKey = declareProviderCredentialsKey(settings, runtime, opts);
  const service = declareCloudRunService(
    {
      settings,
      runtime,
      cronInvoker,
      cronAudience,
      databaseConnectionName: instance.connectionName,
      secrets,
      providerCredentialsKeyId: providerCredentialsKey.id,
    },
    opts,
  );
  const jobs = declareSchedulerJobs(settings, service.uri, cronInvoker, cronAudience, opts);
  const { deployer, provider } = declareGithubDeployer(settings, opts);

  return {
    serviceUrl: service.uri,
    registryUrl: registry.url,
    databaseConnectionName: instance.connectionName,
    providerCredentialsKey: providerCredentialsKey.id,
    cronInvokerEmail: cronInvoker.email,
    cronJobNames: pulumi.all(jobs.map((job) => job.name)),
    deployerEmail: deployer.email,
    workloadIdentityProvider: provider.name,
  };
};
