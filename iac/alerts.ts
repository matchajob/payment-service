import * as gcp from '@pulumi/gcp';
import type * as pulumi from '@pulumi/pulumi';
import { LOG_ALERTS } from '@iac/log-alerts';
import type { StackSettings } from '@iac/stack-settings';

const EMAIL_CHANNEL = 'email';
const ANY_CONDITION = 'OR';
const NOTIFY_AT_MOST_EVERY = '300s';
const MARKDOWN = 'text/markdown';
const CHANNEL_NAME = 'alert-email';

export const declareAlerts = (settings: StackSettings, opts: pulumi.CustomResourceOptions) => {
  const channel = new gcp.monitoring.NotificationChannel(
    CHANNEL_NAME,
    {
      project: settings.project,
      displayName: `payment-service ${settings.environment} alerts`,
      type: EMAIL_CHANNEL,
      labels: { email_address: settings.alertEmail },
    },
    opts,
  );
  return LOG_ALERTS.map(
    (alert) =>
      new gcp.monitoring.AlertPolicy(
        alert.name,
        {
          project: settings.project,
          displayName: `[${settings.environment}] ${alert.title}`,
          combiner: ANY_CONDITION,
          conditions: [{ displayName: alert.title, conditionMatchedLog: { filter: alert.filter } }],
          alertStrategy: { notificationRateLimit: { period: NOTIFY_AT_MOST_EVERY } },
          notificationChannels: [channel.name],
          documentation: { content: alert.whatToDo, mimeType: MARKDOWN },
        },
        opts,
      ),
  );
};
