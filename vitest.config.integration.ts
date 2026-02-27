import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    include: ['tests/integration/**/*.test.tsx', 'tests/integration/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/integration/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['components/**/*.tsx'],
      exclude: ['components/ui/**'],
      thresholds: {
        lines: 70,
        branches: 65,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
