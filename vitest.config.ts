import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const LOCAL_TEST_DATABASE_URL = 
    process.env['TEST_DATABASE_URL'] ??
    'postgresql://postgres:postgres@localhost:54329/payment_service_test';

export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            '@matcha/infra': fileURLToPath(new URL('./node_modules/@matcha/infra', import.meta.url)),
            '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
        },
    },
    test: {
    passWithNoTests: true,
    server: { deps: { inline: [/@matcha\/infra/] } },
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          env: { DATABASE_URL: LOCAL_TEST_DATABASE_URL },
        },
      },
    ],
  },
})