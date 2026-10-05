import { z } from 'zod';
import { taskDateSchema } from './schema.ts';
import { addTaskDays, taskDateAt, weekStart } from './time.ts';

/** Canonical progress only. Local HealthKit previews never enter this contract. */
export const missionSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(['daily_steps', 'weekly_consistency']),
  periodStart: taskDateSchema,
  ruleVersion: z.string().min(1).max(64),
  selectedGoal: z.union([z.literal(3000), z.literal(5000), z.literal(7000)]),
  awardedPoints: z.number().int().min(0).max(30),
  eligibleSteps: z.number().int().min(0).max(100_000).nullable(),
  cutoffAt: z.iso.datetime({ offset: true }),
  tiers: z.array(z.strictObject({ steps: z.number().int().positive(), points: z.number().int().min(1).max(30) })).min(1).max(3),
  weeklyDaysRequired: z.number().int().min(1).max(7),
  weeklyBonusPoints: z.number().int().min(0).max(20),
  qualifyingDates: z.array(taskDateSchema).max(7),
  pendingReview: z.boolean(),
}).refine(m => m.tiers.every((tier, i) => i === 0 || (tier.steps > m.tiers[i - 1]!.steps && tier.points > m.tiers[i - 1]!.points)), 'Tiers must increase')
  .refine(m => {
    try {
      return m.kind === 'daily_steps' ? m.qualifyingDates.length === 0
        : m.eligibleSteps === null && m.awardedPoints <= m.weeklyBonusPoints && weekStart(m.periodStart) === m.periodStart
          && new Set(m.qualifyingDates).size === m.qualifyingDates.length
          && m.qualifyingDates.every(day => day >= m.periodStart && day <= addTaskDays(m.periodStart, 6));
    } catch { return false; }
  }, 'Invalid mission progress');

export const missionsResultSchema = z.strictObject({
  serverNow: z.iso.datetime({ offset: true }),
  taskDate: taskDateSchema,
  timezone: z.literal('Asia/Hong_Kong'),
  items: z.array(missionSchema).max(12),
}).refine(result => {
  try { return taskDateAt(result.serverNow) === result.taskDate; } catch { return false; }
}, 'Server task date mismatch')
  .refine(result => new Set(result.items.map(m => `${m.kind}:${m.periodStart}`)).size === result.items.length
    && new Set(result.items.map(m => m.id)).size === result.items.length, 'Duplicate mission');

export type Mission = z.infer<typeof missionSchema>;
export type MissionsResult = z.infer<typeof missionsResultSchema>;
