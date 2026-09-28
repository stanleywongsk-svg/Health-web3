import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['scripts/local-stack.http.mjs'], environment: 'node', fileParallelism: false,
  testTimeout: 180_000, hookTimeout: 60_000, retry: 0,
} });
