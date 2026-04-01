import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  resolve: {
    alias: {
      '@openfeature/flagd-ofrep-cf-worker': fileURLToPath(
        new URL('./packages/js-ofrep-worker/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/test/**/*.{spec,test}.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      exclude: ['packages/*/src/stash/**'],
      reportsDirectory: 'coverage',
    },
  },
});
