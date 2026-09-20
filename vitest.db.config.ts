import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const domainRequire=createRequire(new URL('./packages/domain/package.json',import.meta.url));
export default defineConfig({
  resolve: { alias: [
    {find:'zod',replacement:domainRequire.resolve('zod')},
    {find:/^@healthloop\/domain$/,replacement:fileURLToPath(new URL('./packages/domain/src/index.ts',import.meta.url))},
    {find:/^@healthloop\/domain\/synthetic$/,replacement:fileURLToPath(new URL('./packages/domain/src/synthetic.ts',import.meta.url))},
  ] },
  test: {
    include: ['scripts/vertical-slice.db.test.mjs'],
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
