import { z } from 'zod';
import { assertTaskDate } from './time.ts';

export const taskDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  try { assertTaskDate(value); return true; } catch { return false; }
}, 'Invalid calendar date');

export const syncCommonShape = {
  taskDate: taskDateSchema,
  eligibleSteps: z.number().int().min(0).max(100_000),
  sourcePinToken: z.uuid(),
  revision: z.number().int().min(1).max(2_147_483_647),
  observedAt: z.iso.datetime({ offset: true }),
  timezone: z.literal('Asia/Hong_Kong'),
};

/** Uploaded values are untrusted claims. Identity is derived exclusively from the session. */
export const activitySyncSchema = z.strictObject({
  ...syncCommonShape,
  sourceCategory: z.enum(['apple_phone', 'apple_watch']),
  sourcePolicy: z.literal('single-approved-source-v1'),
});
export type ActivitySyncInput = z.infer<typeof activitySyncSchema>;

export const claimSchema = z.strictObject({ idempotencyKey: z.uuid() });
export const consentSchema = z.strictObject({
  version: z.literal('2026-09-18'),
  adultConfirmed: z.literal(true),
  localRead: z.boolean(),
  cloudSync: z.boolean(),
  marketing: z.boolean(),
});
export const appealSchema = z.strictObject({
  taskDate: taskDateSchema,
  reason: z.string().trim().min(1).max(1000),
});
