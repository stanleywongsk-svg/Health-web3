import { assertTaskDate, epochMilliseconds, isBeforeCutoff, taskDayBounds, weekStart, type Instant } from './time.ts';

export const SUPPORTED_GOALS = [3000, 5000, 7000] as const;
export type SelectedGoal = typeof SUPPORTED_GOALS[number];
export interface MissionRules {
  version: string;
  tiers: readonly { steps: number; points: number }[];
  dailyCap: number;
  weeklyDays: number;
  weeklyBonus: number;
  lateSyncHour: number;
}
export const DEFAULT_RULES: MissionRules = Object.freeze({
  version: 'steps-v1',
  tiers: Object.freeze([{ steps: 3000, points: 10 }, { steps: 5000, points: 20 }, { steps: 7000, points: 30 }]),
  dailyCap: 30,
  weeklyDays: 3,
  weeklyBonus: 20,
  lateSyncHour: 12,
});
function nonnegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a nonnegative safe integer`);
}
export function assertRules(rules: MissionRules): void {
  if (!rules.version || rules.version.length > 64) throw new RangeError('Missing rule version');
  nonnegativeInteger(rules.dailyCap, 'dailyCap');
  nonnegativeInteger(rules.weeklyBonus, 'weeklyBonus');
  if (rules.dailyCap > 30 || rules.weeklyBonus > 20 || rules.weeklyDays < 1 || rules.weeklyDays > 7 || !Number.isInteger(rules.weeklyDays)) throw new RangeError('Rules exceed product caps');
  if (!Number.isInteger(rules.lateSyncHour) || rules.lateSyncHour < 0 || rules.lateSyncHour > 23) throw new RangeError('Invalid cutoff');
  let lastSteps = -1; let lastPoints = -1;
  for (const tier of rules.tiers) {
    nonnegativeInteger(tier.steps, 'steps'); nonnegativeInteger(tier.points, 'points');
    if (tier.steps <= lastSteps || tier.points <= lastPoints || tier.points > rules.dailyCap) throw new RangeError('Tiers must increase and respect daily cap');
    lastSteps = tier.steps; lastPoints = tier.points;
  }
}
export function dailyEntitlement(steps: number, rules: MissionRules = DEFAULT_RULES): number {
  nonnegativeInteger(steps, 'steps'); assertRules(rules);
  return Math.min(rules.dailyCap, rules.tiers.reduce((points, tier) => steps >= tier.steps ? tier.points : points, 0));
}
/** postedPoints is the canonical net posted entitlement, never a client-provided amount. */
export function topUp(entitlement: number, postedPoints: number, cap = 30): number {
  nonnegativeInteger(entitlement, 'entitlement'); nonnegativeInteger(postedPoints, 'postedPoints'); nonnegativeInteger(cap, 'cap');
  return Math.max(0, Math.min(entitlement, cap) - postedPoints);
}
export interface QualifyingDay { taskDate: string; eligibleSteps: number }
export function weeklyEntitlement(days: readonly QualifyingDay[], taskWeek: string, selectedGoal: SelectedGoal = 3000, rules: MissionRules = DEFAULT_RULES): number {
  assertTaskDate(taskWeek); assertRules(rules);
  if (weekStart(taskWeek) !== taskWeek) throw new RangeError('Task week must start Monday');
  if (!SUPPORTED_GOALS.includes(selectedGoal)) throw new RangeError('Unsupported selected goal');
  // A canonical accepted summary per day is required. Duplicate inputs must never inflate days.
  const seen = new Map<string, number>();
  for (const day of days) {
    assertTaskDate(day.taskDate); nonnegativeInteger(day.eligibleSteps, 'eligibleSteps');
    if (weekStart(day.taskDate) !== taskWeek) continue;
    const existing = seen.get(day.taskDate);
    if (existing !== undefined && existing !== day.eligibleSteps) throw new RangeError('Conflicting revisions require canonical resolution');
    seen.set(day.taskDate, day.eligibleSteps);
  }
  return [...seen.values()].filter((steps) => steps >= selectedGoal).length >= rules.weeklyDays ? rules.weeklyBonus : 0;
}
export interface MissionPin {
  taskDate: string;
  ruleVersion: string;
  selectedGoal: SelectedGoal;
  sourcePolicy: string;
  sourcePinToken: string;
}
export function assertMissionPinUnchanged(existing: MissionPin, proposed: MissionPin): void {
  const keys: Array<keyof MissionPin> = ['taskDate', 'ruleVersion', 'selectedGoal', 'sourcePolicy', 'sourcePinToken'];
  if (keys.some((key) => existing[key] !== proposed[key])) throw new RangeError('Pinned mission attributes cannot change');
}
export function dailyBusinessKey(taskDate: string): string { assertTaskDate(taskDate); return `walking:day:${taskDate}`; }
export function weeklyBusinessKey(taskWeek: string): string { return `walking:week:${weekStart(taskWeek)}`; }
export type DailyEvaluation =
  | { status: 'eligible'; entitlement: number; delta: number }
  | { status: 'review_required'; reason: 'deadline' | 'decreased_entitlement'; entitlement: number; delta: 0 };
export function evaluateDaily(input: { mission: MissionPin; steps: number; postedPoints: number; serverNow: Instant; rules?: MissionRules }): DailyEvaluation {
  const rules = input.rules ?? DEFAULT_RULES;
  if (input.mission.ruleVersion !== rules.version) throw new RangeError('Load the pinned mission rule version');
  if (!SUPPORTED_GOALS.includes(input.mission.selectedGoal)) throw new RangeError('Unsupported goal');
  if (epochMilliseconds(input.serverNow) < epochMilliseconds(taskDayBounds(input.mission.taskDate).startAt)) throw new RangeError('Future task date');
  const entitlement = dailyEntitlement(input.steps, rules);
  nonnegativeInteger(input.postedPoints, 'postedPoints');
  if (!isBeforeCutoff(input.mission.taskDate, input.serverNow, rules.lateSyncHour)) return { status: 'review_required', reason: 'deadline', entitlement, delta: 0 };
  if (entitlement < input.postedPoints) return { status: 'review_required', reason: 'decreased_entitlement', entitlement, delta: 0 };
  return { status: 'eligible', entitlement, delta: topUp(entitlement, input.postedPoints, rules.dailyCap) };
}
export interface AcceptedRevision { revision: number; eligibleSteps: number; sourcePinToken: string; sourcePolicy: string }
export type RevisionDecision = 'accept' | 'duplicate' | 'stale' | 'review_required';
export function evaluateRevision(existing: AcceptedRevision | null, incoming: AcceptedRevision): RevisionDecision {
  if (!Number.isSafeInteger(incoming.revision) || incoming.revision < 1) throw new RangeError('Invalid revision');
  nonnegativeInteger(incoming.eligibleSteps, 'eligibleSteps');
  if (!incoming.sourcePinToken || !incoming.sourcePolicy) throw new RangeError('Missing source pin');
  if (!existing) return 'accept';
  if (existing.sourcePinToken !== incoming.sourcePinToken || existing.sourcePolicy !== incoming.sourcePolicy) return 'review_required';
  if (incoming.revision < existing.revision) return 'stale';
  if (incoming.revision === existing.revision) {
    if (incoming.eligibleSteps !== existing.eligibleSteps) throw new RangeError('Revision conflict');
    return 'duplicate';
  }
  return incoming.eligibleSteps < existing.eligibleSteps ? 'review_required' : 'accept';
}
export type Reconciliation =
  | { status: 'unchanged'; delta: 0 }
  | { status: 'review_required'; delta: 0 }
  | { status: 'compensating_entry'; delta: number; originalEntryId: string; reason: string; actor: string; reviewer: string };
/** Applies equally to daily and dependent weekly corrections. Does not mutate posted history. */
export function reconcileEntitlement(input: {
  entitlement: number; postedPoints: number; cap: number; originalEntryId: string;
  review?: { reason: string; actor: string; reviewer: string; approved: boolean };
}): Reconciliation {
  nonnegativeInteger(input.entitlement, 'entitlement'); nonnegativeInteger(input.postedPoints, 'postedPoints'); nonnegativeInteger(input.cap, 'cap');
  const delta = Math.min(input.entitlement, input.cap) - input.postedPoints;
  if (delta === 0) return { status: 'unchanged', delta: 0 };
  const review = input.review;
  if (!review?.approved || !review.reason.trim() || !review.actor || !review.reviewer || review.actor === review.reviewer || !input.originalEntryId) return { status: 'review_required', delta: 0 };
  return { status: 'compensating_entry', delta, originalEntryId: input.originalEntryId, reason: review.reason.trim(), actor: review.actor, reviewer: review.reviewer };
}
export function spendablePoints(ledgerBalance: number): number {
  if (!Number.isSafeInteger(ledgerBalance)) throw new RangeError('Invalid ledger balance');
  return Math.max(0, ledgerBalance);
}
