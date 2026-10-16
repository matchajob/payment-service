import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import { DEPLOYER_ROLES } from '@iac/deployer-roles';
import { deployerTrustCondition } from '@iac/deployer-trust-condition';
import { GITHUB_TOKEN_CLAIM } from '@iac/github-token-claims';
import type { StackSettings } from '@iac/stack-settings';

const POOL_ID = 'github';
const PROVIDER_ID = 'github-actions';
const DEPLOYER_ACCOUNT_ID = 'github-deployer';
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';

const WORKLOAD_IDENTITY_USER_ROLE = 'roles/iam.workloadIdentityUser';
const REPOSITORY_ATTRIBUTE = 'attribute.repository';
const ROLE_PREFIX = 'roles/';
const ROLE_SEGMENT_SEPARATOR = '.';
const RESOURCE_NAME_SEPARATOR = '-';

const roleBindingName = (role: string) =>
  `${DEPLOYER_ACCOUNT_ID}${RESOURCE_NAME_SEPARATOR}${role.replace(ROLE_PREFIX, '').replaceAll(ROLE_SEGMENT_SEPARATOR, RESOURCE_NAME_SEPARATOR)}`;

export const declareGithubDeployer = (settings: StackSettings, opts: pulumi.CustomResourceOptions) => {
  const pool = new gcp.iam.WorkloadIdentityPool(
    POOL_ID,
    { project: settings.project, workloadIdentityPoolId: POOL_ID, displayName: 'GitHub Actions' },
    opts,
  );
  const provider = new gcp.iam.WorkloadIdentityPoolProvider(
    PROVIDER_ID,
    {
      project: settings.project,
      workloadIdentityPoolId: pool.workloadIdentityPoolId,
      workloadIdentityPoolProviderId: PROVIDER_ID,
      attributeMapping: {
        'google.subject': GITHUB_TOKEN_CLAIM.SUBJECT,
        [REPOSITORY_ATTRIBUTE]: GITHUB_TOKEN_CLAIM.REPOSITORY,
      },
      attributeCondition: deployerTrustCondition(settings),
      oidc: { issuerUri: GITHUB_ISSUER },
    },
    opts,
  );
  const deployer = new gcp.serviceaccount.Account(
    DEPLOYER_ACCOUNT_ID,
    { project: settings.project, accountId: DEPLOYER_ACCOUNT_ID, displayName: 'GitHub Actions: pulumi preview and up' },
    opts,
  );
  new gcp.serviceaccount.IAMMember(
    'github-deployer-workload-identity',
    {
      serviceAccountId: deployer.name,
      role: WORKLOAD_IDENTITY_USER_ROLE,
      member: pulumi.interpolate`principalSet://iam.googleapis.com/${pool.name}/${REPOSITORY_ATTRIBUTE}/${settings.githubRepository}`,
    },
    opts,
  );
  DEPLOYER_ROLES.forEach(
    (role) =>
      new gcp.projects.IAMMember(
        roleBindingName(role),
        { project: settings.project, role, member: deployer.member },
        opts,
      ),
  );
  return { deployer, provider };
};
