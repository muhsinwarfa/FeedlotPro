import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'unit',
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['lib/formatters.ts', 'lib/validators.ts', 'lib/errors.ts', 'lib/utils.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
