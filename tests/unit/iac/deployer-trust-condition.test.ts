import { describe, expect, it } from 'vitest';
import { deployerTrustCondition } from '@iac/deployer-trust-condition';

const REPOSITORY = 'example/payment-service';

describe('deployer trust condition (ADR 0012)', () => {
  it('lets only the main branch of the repository become the production deployer', () => {
    expect(deployerTrustCondition({ environment: 'production', githubRepository: REPOSITORY })).toBe(
      `assertion.repository == "${REPOSITORY}" && assertion.ref == "refs/heads/main"`,
    );
  });

  it('lets any branch of the repository become the staging deployer, so branches can preview', () => {
    expect(deployerTrustCondition({ environment: 'staging', githubRepository: REPOSITORY })).toBe(
      `assertion.repository == "${REPOSITORY}"`,
    );
  });
});
