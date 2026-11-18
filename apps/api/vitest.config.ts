import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // tests/schema/* share one database and clean up after themselves —
    // they must not run concurrently against the same rows.
    fileParallelism: false,
  },
});
