import { z } from 'zod';
import { taskDateSchema } from './schema.ts';
import { taskDateAt, weekStart } from './time.ts';

/** Recognition of existing canonical awards; no spending, minting or extra health reads. */
export const platformBadgeSchema = z.strictObject({
  id: z.enum(['first_steps', 'consistent_week']),
  earned: z.boolean(),
  earnedOn: taskDateSchema.nullable(),
}).refine(b => b.earned === (b.earnedOn !== null), 'Badge status must match its qualifying period')
  .refine(b => { try { return b.id !== 'consistent_week' || b.earnedOn === null || weekStart(b.earnedOn) === b.earnedOn; } catch { return false; } },
    'Weekly badge date must identify the task week');
export const badgesResultSchema = z.strictObject({
  items: z.array(platformBadgeSchema).length(2),
  evaluatedAt: z.iso.datetime({ offset: true }),
}).refine(result => new Set(result.items.map(b => b.id)).size === 2, 'Badge IDs must be unique')
  .refine(result => { try { return result.items.every(b => b.earnedOn === null || b.earnedOn <= taskDateAt(result.evaluatedAt)); } catch { return false; } },
    'A badge cannot precede its qualifying activity');
export type PlatformBadge = z.infer<typeof platformBadgeSchema>;
export type BadgesResult = z.infer<typeof badgesResultSchema>;
