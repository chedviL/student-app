import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/integration/integrationSetup.ts'],
    include: ['src/test/integration/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run integration tests sequentially — DB state must be predictable
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
