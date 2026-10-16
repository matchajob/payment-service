import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import type { StackSettings } from '@iac/stack-settings';

const REPOSITORY_ID = 'payment-service';
const KEEP_RECENT_IMAGES = 20;

export const declareArtifactRegistry = (settings: StackSettings, opts: pulumi.CustomResourceOptions) => {
  const repository = new gcp.artifactregistry.Repository(
    REPOSITORY_ID,
    {
      project: settings.project,
      location: settings.region,
      repositoryId: REPOSITORY_ID,
      format: 'DOCKER',
      cleanupPolicies: [{ id: 'keep-recent', action: 'KEEP', mostRecentVersions: { keepCount: KEEP_RECENT_IMAGES } }],
    },
    opts,
  );
  const url = pulumi.interpolate`${settings.region}-docker.pkg.dev/${settings.project}/${repository.repositoryId}`;
  return { repository, url };
};
