/** Explicit test/demo entry point. Native real-data bundles must not import this file. */
import { z } from 'zod';
import { syncCommonShape } from './schema.ts';
export const demoActivitySyncSchema = z.strictObject({
  ...syncCommonShape,
  sourceCategory: z.literal('synthetic_demo'),
  sourcePolicy: z.literal('synthetic-demo-v1'),
});
export type DemoActivitySyncInput = z.infer<typeof demoActivitySyncSchema>;
