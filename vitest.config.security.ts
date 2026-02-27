import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'security',
    include: ['tests/security/**/*.test.ts'],
    environment: 'node',
    globals: true,
    // HTTP round-trips to localhost:3000 — allow extra time
    testTimeout: 15000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
