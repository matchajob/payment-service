import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/create-client.ts',
    'src/payment-service-error.ts',
    'src/verify-and-parse-event.ts',
    'src/event-verification-error.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  external: ['zod'],
});
