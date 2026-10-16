import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import type { StackSettings } from '@iac/stack-settings';

const RUNTIME_ACCOUNT_ID = 'payment-service-runtime';
const CRON_INVOKER_ACCOUNT_ID = 'cron-invoker';
const CLOUDSQL_CLIENT_ROLE = 'roles/cloudsql.client';

export const declareServiceAccounts = (settings: StackSettings, opts: pulumi.CustomResourceOptions) => {
  const runtime = new gcp.serviceaccount.Account(
    RUNTIME_ACCOUNT_ID,
    { project: settings.project, accountId: RUNTIME_ACCOUNT_ID, displayName: 'payment-service Cloud Run runtime' },
    opts,
  );
  const cronInvoker = new gcp.serviceaccount.Account(
    CRON_INVOKER_ACCOUNT_ID,
    {
      project: settings.project,
      accountId: CRON_INVOKER_ACCOUNT_ID,
      displayName: 'Cloud Scheduler identity for /internal/cron',
    },
    opts,
  );
  new gcp.projects.IAMMember(
    'runtime-cloudsql-client',
    { project: settings.project, role: CLOUDSQL_CLIENT_ROLE, member: runtime.member },
    opts,
  );
  return { runtime, cronInvoker };
};
