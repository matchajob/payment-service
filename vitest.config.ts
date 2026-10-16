import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/utils/test-database-url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@matcha/infra': fileURLToPath(new URL('./node_modules/@matcha/infra', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
      '@iac': fileURLToPath(new URL('./iac', import.meta.url)),
    },
  },
  test: {
    passWithNoTests: true,
    server: { deps: { inline: [/@matcha\/infra/] } },
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], sequence: { groupOrder: 0 } } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          globalSetup: ['tests/setup/migrate-test-database.ts'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration-serial',
          include: ['tests/integration-serial/**/*.test.ts'],
          env: { DATABASE_URL: TEST_DATABASE_URL },
          globalSetup: ['tests/setup/migrate-test-database.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
