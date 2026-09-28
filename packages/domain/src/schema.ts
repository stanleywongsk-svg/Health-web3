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

/** IDs stay strings across JSON: PostgreSQL bigint cursors can exceed JS safe integers. */
export const recordCursorSchema = z.string().regex(/^[1-9]\d{0,17}$/);
export const recordPageSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: recordCursorSchema.optional(),
});
export type RecordPageInput = z.input<typeof recordPageSchema>;
export const redeemRewardSchema = z.strictObject({ rewardId: z.uuid(), idempotencyKey: z.uuid() });
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;
export const rewardSchema = z.strictObject({
  id: z.uuid(), titleKey: z.string().min(1).max(100), pointsCost: z.number().int().positive(),
  stock: z.number().int().nonnegative(), isDemo: z.literal(true),
});
export const rewardsResultSchema = z.strictObject({ items: z.array(rewardSchema) });
export const redeemResultSchema = z.strictObject({
  id: z.uuid(), status: z.enum(['demonstration', 'cancelled']), demoCode: z.uuid(), pointsCost: z.number().int().positive(),
});
export const redemptionSchema = redeemResultSchema.extend({ rewardId: z.uuid(), createdAt: z.iso.datetime({ offset: true }) });
export const redemptionPageSchema = z.strictObject({ items: z.array(redemptionSchema), nextCursor: recordCursorSchema.nullable() });
export const cancelRedemptionResultSchema = z.strictObject({ id: z.uuid(), status: z.literal('cancelled') });
export type Reward = z.infer<typeof rewardSchema>;
export type Redemption = z.infer<typeof redemptionSchema>;
export type RedemptionPage = z.infer<typeof redemptionPageSchema>;
export type RedeemResult = z.infer<typeof redeemResultSchema>;
export type CancelRedemptionResult = z.infer<typeof cancelRedemptionResultSchema>;

const revisionSchema = z.number().int().min(1).max(2_147_483_647);
const timestampSchema = z.iso.datetime({ offset: true });
const reviewReasonSchema = z.string().trim().min(10).max(1000);
const proposalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

/** The referenced appeal resolves the subject/day; only the stored pending revision may be reviewed. */
export const proposeAppealSchema = z.strictObject({
  appealId: z.uuid(), revision: revisionSchema, reason: reviewReasonSchema, idempotencyKey: z.uuid(),
});
export const decideAppealSchema = z.strictObject({
  decision: z.enum(['approve', 'reject']), reason: reviewReasonSchema, idempotencyKey: z.uuid(),
});
export const appealProposalSchema = z.strictObject({
  id: z.uuid(), revision: revisionSchema, status: proposalStatusSchema, proposalReason: reviewReasonSchema,
  decisionReason: reviewReasonSchema.nullable(), createdAt: timestampSchema, decidedAt: timestampSchema.nullable(),
}).refine((p) => p.status === 'pending'
  ? p.decisionReason === null && p.decidedAt === null
  : p.decisionReason !== null && p.decidedAt !== null, 'Proposal decision state is incomplete');
export const appealAdjustmentExportSchema = appealProposalSchema.safeExtend({ appealId: z.uuid(), taskDate: taskDateSchema });
export const appealRecordSchema = z.strictObject({
  id: z.uuid(), sequenceId: recordCursorSchema, taskDate: taskDateSchema,
  reason: z.string().min(1).max(1000), status: z.enum(['open', 'resolved']), createdAt: timestampSchema,
  proposals: z.array(appealProposalSchema),
});
export const appealPageSchema = z.strictObject({ items: z.array(appealRecordSchema).max(100), nextCursor: recordCursorSchema.nullable() });
export const adminReviewSchema = appealRecordSchema.extend({
  subjectId: z.uuid(),
  canonicalSummary: z.strictObject({ eligibleSteps: z.number().int().min(0).max(100_000), revision: revisionSchema }).nullable(),
  pendingSubmissions: z.array(z.strictObject({
    revision: revisionSchema, eligibleSteps: z.number().int().min(0).max(100_000),
    sourceCategory: z.enum(['apple_phone', 'apple_watch']), observedAt: timestampSchema,
    reason: z.enum(['excessive_steps', 'excessive_increment', 'downward_revision']),
  })),
});
export const adminReviewPageSchema = z.strictObject({ items: z.array(adminReviewSchema).max(100), nextCursor: recordCursorSchema.nullable() });
export const proposeAppealResultSchema = z.strictObject({
  id: z.uuid(), appealId: z.uuid(), revision: revisionSchema, status: z.literal('pending'), createdAt: timestampSchema,
});
export const decideAppealResultSchema = z.strictObject({
  id: z.uuid(), appealId: z.uuid(), status: z.enum(['approved', 'rejected']), decision: z.enum(['approve', 'reject']),
  addedPoints: z.number().int().min(-50).max(50), dailyDelta: z.number().int().min(-30).max(30),
  weeklyDelta: z.number().int().min(-20).max(20), balance: z.number().int(), availablePoints: z.number().int().nonnegative(),
  decidedAt: timestampSchema,
}).refine((r) => r.availablePoints === Math.max(0, r.balance)
  && r.addedPoints === r.dailyDelta + r.weeklyDelta
  && (r.decision === 'approve' ? r.status === 'approved' : r.status === 'rejected' && r.dailyDelta === 0 && r.weeklyDelta === 0),
'Decision outcome is inconsistent');

export const pointsSummarySchema = z.strictObject({
  balance: z.number().int(), availablePoints: z.number().int().nonnegative(), pendingEvaluations: z.number().int().nonnegative(),
  earnedPoints: z.number().int().nonnegative(), spentPoints: z.number().int().nonnegative(),
  reversedPoints: z.number().int().nonnegative(), correctionPoints: z.number().int(),
}).refine((p) => p.availablePoints === Math.max(0, p.balance)
  && p.balance === p.earnedPoints - p.spentPoints + p.reversedPoints + p.correctionPoints, 'Points summary must reconcile');
export const ledgerEntrySchema = z.strictObject({
  id: recordCursorSchema, kind: z.enum(['daily_award', 'weekly_award', 'daily_correction', 'weekly_correction', 'redemption', 'refund']),
  points: z.number().int().refine((p) => p !== 0), createdAt: timestampSchema,
  instanceId: z.uuid().nullable(), adjustmentId: z.uuid().nullable(), relatedEntryId: recordCursorSchema.nullable(),
}).refine((entry) => {
  if (entry.kind === 'daily_correction' || entry.kind === 'weekly_correction') return entry.adjustmentId !== null && entry.instanceId !== null;
  return entry.adjustmentId === null && entry.relatedEntryId === null
    && (entry.kind === 'redemption' ? entry.points < 0 : entry.points > 0);
}, 'Ledger entry kind and correction links are inconsistent');
export const ledgerPageSchema = z.strictObject({ items: z.array(ledgerEntrySchema).max(100), nextCursor: recordCursorSchema.nullable() });

export type ProposeAppealInput = z.infer<typeof proposeAppealSchema>;
export type DecideAppealInput = z.infer<typeof decideAppealSchema>;
export type AppealProposal = z.infer<typeof appealProposalSchema>;
export type AppealAdjustmentExport = z.infer<typeof appealAdjustmentExportSchema>;
export type Appeal = z.infer<typeof appealRecordSchema>;
export type AppealPage = z.infer<typeof appealPageSchema>;
export type AdminReview = z.infer<typeof adminReviewSchema>;
export type AdminReviewPage = z.infer<typeof adminReviewPageSchema>;
export type ProposeAppealResult = z.infer<typeof proposeAppealResultSchema>;
export type DecideAppealResult = z.infer<typeof decideAppealResultSchema>;
export type PointsSummary = z.infer<typeof pointsSummarySchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type LedgerPage = z.infer<typeof ledgerPageSchema>;

/** A local wall-clock time in the fixed task timezone, never the device timezone. */
export const reminderTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const notificationPreferenceFields = {
  enabled: z.boolean(), reminderTime: reminderTimeSchema, quietStart: reminderTimeSchema, quietEnd: reminderTimeSchema,
  timezone: z.literal('Asia/Hong_Kong'),
};
type NotificationTimes = { enabled: boolean; reminderTime: string; quietStart: string; quietEnd: string };
function validNotificationTimes(p: NotificationTimes): boolean {
  if (p.quietStart === p.quietEnd) return false;
  // Valid HH:mm strings sort chronologically; the quiet interval is [start, end).
  const quiet = p.quietStart < p.quietEnd
    ? p.reminderTime >= p.quietStart && p.reminderTime < p.quietEnd
    : p.reminderTime >= p.quietStart || p.reminderTime < p.quietEnd;
  return !p.enabled || !quiet;
}
const preferenceRevisionSchema = z.number().int().min(0).max(2_147_483_647);
export const setNotificationPreferencesSchema = z.strictObject({
  ...notificationPreferenceFields, expectedRevision: preferenceRevisionSchema,
}).refine(validNotificationTimes, 'Enabled reminders must fall outside a nonempty quiet interval');
export const notificationPreferencesSchema = z.strictObject({
  ...notificationPreferenceFields, revision: preferenceRevisionSchema, updatedAt: timestampSchema.nullable(),
}).refine(validNotificationTimes, 'Invalid notification quiet interval')
  .refine(p => p.revision === 0
    ? !p.enabled && p.reminderTime === '19:00' && p.quietStart === '22:00' && p.quietEnd === '08:00' && p.updatedAt === null
    : p.updatedAt !== null, 'Notification preference revision must describe persisted state or the disabled default');
export type NotificationPreferencesInput = z.infer<typeof setNotificationPreferencesSchema>;
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
