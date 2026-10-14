import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const supabaseMessage =
  'The database is plain Postgres. Supabase is the host, not a dependency. Keep it swappable for RDS.';
const relativeParentMessage = 'Use absolute imports (@/*), never relative parent paths.';
const contractPurityMessage =
  'src/contract is published zod-only. Import only zod and payment-service/contract/*.';
const libNoApiMessage = 'src/lib must not depend on the HTTP edge (src/api).';
const libNoHonoMessage = 'hono stays in src/api.';
const infraPortabilityMessage =
  'src/infra is portable: it imports only @matcha/infra/* and node_modules, never @/*.';

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.config.{js,cjs,mjs,ts}'],
  },
  {
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: { parser: tseslint.parser },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@supabase/*'], message: supabaseMessage },
            { regex: '^\\.\\.', message: relativeParentMessage },
          ],
        },
      ],
    },
  },
  {
    files: ['src/contract/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/*',
                '@matcha/*',
                'hono',
                'hono/**',
                'drizzle-orm',
                'drizzle-orm/**',
                'postgres',
                'node:*',
                'vitest',
              ],
              message: contractPurityMessage,
            },
            { group: ['@supabase/*'], message: supabaseMessage },
            { regex: '^\\.\\.', message: relativeParentMessage },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/api/*'], message: libNoApiMessage },
            { group: ['hono', 'hono/**'], message: libNoHonoMessage },
            { group: ['@supabase/*'], message: supabaseMessage },
            { regex: '^\\.\\.', message: relativeParentMessage },
          ],
        },
      ],
    },
  },
  {
    files: ['src/infra/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/*'], message: infraPortabilityMessage },
            { regex: '^\\.\\.', message: relativeParentMessage },
          ],
        },
      ],
    },
  },
]);
