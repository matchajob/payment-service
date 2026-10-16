import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import { CRON_JOBS } from '@iac/cron-jobs';
import { REQUEST_TIMEOUT } from '@iac/request-timeout';
import type { StackSettings } from '@iac/stack-settings';

const SCHEDULE_TIME_ZONE = 'Asia/Jerusalem';

export const declareSchedulerJobs = (
  settings: StackSettings,
  serviceUri: pulumi.Output<string>,
  invoker: gcp.serviceaccount.Account,
  audience: string,
  opts: pulumi.CustomResourceOptions,
) =>
  CRON_JOBS.map(
    (job) =>
      new gcp.cloudscheduler.Job(
        job.name,
        {
          project: settings.project,
          region: settings.region,
          name: job.name,
          schedule: job.schedule,
          timeZone: SCHEDULE_TIME_ZONE,
          retryConfig: { retryCount: job.retryCount },
          attemptDeadline: REQUEST_TIMEOUT,
          httpTarget: {
            uri: pulumi.interpolate`${serviceUri}${job.path}`,
            httpMethod: 'POST',
            oidcToken: { serviceAccountEmail: invoker.email, audience },
          },
        },
        opts,
      ),
  );
