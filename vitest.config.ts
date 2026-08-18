import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/test/unit/**/*.test.ts', 'src/test/unit/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/utils/**',
        'src/api/**',
        'src/components/**',
        'src/pages/**',
        'src/context/**',
        'src/hooks/**',
      ],
      exclude: ['src/test/**', 'src/**/*.css', 'src/assets/**', 'src/images/**'],
    },
  },
});
