import { PRODUCTION } from '@iac/environments';
import { GITHUB_TOKEN_CLAIM } from '@iac/github-token-claims';
import type { StackSettings } from '@iac/stack-settings';

const MAIN_REF = 'refs/heads/main';

export const deployerTrustCondition = ({
  environment,
  githubRepository,
}: Pick<StackSettings, 'environment' | 'githubRepository'>) => {
  const sameRepository = `${GITHUB_TOKEN_CLAIM.REPOSITORY} == "${githubRepository}"`;
  return environment === PRODUCTION
    ? `${sameRepository} && ${GITHUB_TOKEN_CLAIM.REF} == "${MAIN_REF}"`
    : sameRepository;
};
