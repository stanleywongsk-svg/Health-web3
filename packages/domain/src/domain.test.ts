import { describe, expect, it } from 'vitest';
import { activitySyncSchema, addTaskDays, assertMissionPinUnchanged, dailyBusinessKey, dailyEntitlement, DEFAULT_RULES, evaluateDaily, evaluateRevision, isBeforeCutoff, lateSyncCutoff, reconcileEntitlement, spendablePoints, taskDateAt, taskDayBounds, topUp, weeklyBusinessKey, weeklyEntitlement, weekStart, type MissionPin } from './index.ts';
import { demoActivitySyncSchema } from './synthetic.ts';
const token = 'a18803d0-6467-4703-b86f-f272b4afda38';
const pin: MissionPin = { taskDate: '2026-09-18', ruleVersion: 'steps-v1', selectedGoal: 3000, sourcePolicy: 'single-approved-source-v1', sourcePinToken: token };
const sync = { taskDate: pin.taskDate, eligibleSteps: 3000, sourceCategory: 'apple_watch', sourcePolicy: pin.sourcePolicy, sourcePinToken: token, revision: 1, observedAt: '2026-09-18T14:00:00+08:00', timezone: 'Asia/Hong_Kong' };

describe('highest entitlement, differences, caps and version pinning', () => {
  it.each([[0, 0], [2999, 0], [3000, 10], [4999, 10], [5000, 20], [6999, 20], [7000, 30], [100000, 30]])('%i steps gives %i', (steps, points) => expect(dailyEntitlement(steps)).toBe(points));
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid steps %s', (steps) => expect(() => dailyEntitlement(steps)).toThrow());
  it('tops up only the outstanding difference', () => {
    expect(topUp(dailyEntitlement(5000), 10)).toBe(10);
    expect(topUp(dailyEntitlement(7000), 20)).toBe(10);
    expect(topUp(30, 30)).toBe(0); expect(topUp(20, 30)).toBe(0); expect(topUp(100, 10)).toBe(20);
  });
  it('holds decreased entitlements for reviewed reconciliation', () => expect(evaluateDaily({ mission: pin, steps: 3000, postedPoints: 20, serverNow: sync.observedAt })).toEqual({ status: 'review_required', reason: 'decreased_entitlement', entitlement: 10, delta: 0 }));
  it('requires the pinned rules and rejects over-cap publication', () => {
    expect(() => evaluateDaily({ mission: pin, steps: 7000, postedPoints: 0, serverNow: sync.observedAt, rules: { ...DEFAULT_RULES, version: 'v2' } })).toThrow();
    expect(() => dailyEntitlement(7000, { ...DEFAULT_RULES, dailyCap: 100 })).toThrow();
  });
  it.each(['taskDate', 'ruleVersion', 'selectedGoal', 'sourcePolicy', 'sourcePinToken'] as const)('does not allow pinned %s to change', (key) => {
    expect(() => assertMissionPinUnchanged(pin, { ...pin, [key]: key === 'selectedGoal' ? 5000 : 'changed' })).toThrow();
  });
  it('same-day business key does not contain version', () => { expect(dailyBusinessKey(pin.taskDate)).toBe('walking:day:2026-09-18'); expect(weeklyBusinessKey(pin.taskDate)).toBe('walking:week:2026-09-14'); });
});

describe('Hong Kong task time and closed deadline', () => {
  it.each([['2026-09-18T15:59:59.999Z', '2026-09-18'], ['2026-09-18T16:00:00Z', '2026-09-19'], ['2026-09-18T09:00:00-07:00', '2026-09-19']])('converts %s to %s', (instant, day) => expect(taskDateAt(instant)).toBe(day));
  it('uses Monday through Sunday across year rollover', () => {
    expect(weekStart('2027-01-03')).toBe('2026-12-28'); expect(weekStart('2027-01-04')).toBe('2027-01-04');
    expect(addTaskDays('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('has explicit local-day bounds', () => expect(taskDayBounds('2026-09-18')).toEqual({ startAt: '2026-09-17T16:00:00.000Z', endAt: '2026-09-18T16:00:00.000Z' }));
  it('accepts before noon and closes exactly at noon following day', () => {
    expect(lateSyncCutoff('2026-09-18')).toBe('2026-09-19T04:00:00.000Z');
    expect(isBeforeCutoff('2026-09-18', '2026-09-19T03:59:59.999Z')).toBe(true);
    expect(isBeforeCutoff('2026-09-18', '2026-09-19T04:00:00Z')).toBe(false);
    expect(isBeforeCutoff('2026-09-18', '2026-09-19T04:00:00.001Z')).toBe(false);
    expect(lateSyncCutoff('2026-09-18', 9)).toBe('2026-09-19T01:00:00.000Z');
  });
  it('uses server time even if client supplied an earlier observation', () => {
    const uploaded = { ...sync, observedAt: '2026-09-18T00:00:00+08:00' };
    expect(evaluateDaily({ mission: pin, steps: uploaded.eligibleSteps, postedPoints: 0, serverNow: '2026-09-19T04:00:00Z' }).status).toBe('review_required');
  });
  it.each(['2026-02-30', '2026-9-18', '1900-01-01', '2101-01-01'])('rejects malformed/range date %s', (date) => expect(() => taskDayBounds(date)).toThrow());
  it('rejects timezone-less instants and future mission dates', () => {
    expect(() => taskDateAt('2026-09-18T12:00:00')).toThrow();
    expect(() => evaluateDaily({ mission: pin, steps: 3000, postedPoints: 0, serverNow: '2026-09-16T00:00:00Z' })).toThrow();
  });
});

describe('weekly distinct canonical days and controlled corrections', () => {
  const days = [{ taskDate: '2026-09-14', eligibleSteps: 3000 }, { taskDate: '2026-09-15', eligibleSteps: 5000 }, { taskDate: '2026-09-16', eligibleSteps: 7000 }];
  it('awards 20 exactly after three qualifying distinct days', () => {
    expect(weeklyEntitlement(days.slice(0, 2), '2026-09-14')).toBe(0);
    expect(weeklyEntitlement(days, '2026-09-14')).toBe(20);
    expect(weeklyEntitlement([...days, ...days], '2026-09-14')).toBe(20);
  });
  it('does not duplicate a day or cross week boundary', () => {
    expect(weeklyEntitlement([days[0]!, days[0]!, { taskDate: '2026-09-21', eligibleSteps: 7000 }], '2026-09-14')).toBe(0);
    expect(weeklyEntitlement(days, '2026-09-14', 5000)).toBe(0);
  });
  it('rejects contradictory revisions and non-Monday period', () => {
    expect(() => weeklyEntitlement([...days, { ...days[0]!, eligibleSteps: 0 }], '2026-09-14')).toThrow();
    expect(() => weeklyEntitlement(days, '2026-09-15')).toThrow();
  });
  it('weekly reversal requires independent approval and preserves the original reference', () => {
    const entitlement = weeklyEntitlement([{ ...days[0]!, eligibleSteps: 1000 }, ...days.slice(1)], '2026-09-14');
    const input = { entitlement, postedPoints: 20, cap: 20, originalEntryId: 'original-weekly-entry' };
    expect(reconcileEntitlement(input)).toEqual({ status: 'review_required', delta: 0 });
    expect(reconcileEntitlement({ ...input, review: { approved: true, actor: 'c', reviewer: 'c', reason: 'Correction' } }).status).toBe('review_required');
    expect(reconcileEntitlement({ ...input, review: { approved: true, actor: 'c', reviewer: 'b', reason: 'Approved corrected source' } })).toMatchObject({ status: 'compensating_entry', delta: -20, originalEntryId: 'original-weekly-entry' });
    expect(spendablePoints(-10)).toBe(0);
  });
  it('caps approved positive corrections and does not alter unchanged history', () => {
    expect(reconcileEntitlement({ entitlement: 80, postedPoints: 20, cap: 30, originalEntryId: 'x', review: { approved: true, actor: 'c', reviewer: 'b', reason: 'Correction' } })).toMatchObject({ delta: 10 });
    expect(reconcileEntitlement({ entitlement: 20, postedPoints: 20, cap: 30, originalEntryId: 'x' })).toEqual({ status: 'unchanged', delta: 0 });
  });
  it('resolves revisions without automatic source or downward replacement', () => {
    const original = { revision: 2, eligibleSteps: 5000, sourcePinToken: token, sourcePolicy: pin.sourcePolicy };
    expect(evaluateRevision(null, original)).toBe('accept');
    expect(evaluateRevision(original, original)).toBe('duplicate');
    expect(evaluateRevision(original, { ...original, revision: 1 })).toBe('stale');
    expect(() => evaluateRevision(original, { ...original, eligibleSteps: 7000 })).toThrow();
    expect(evaluateRevision(original, { ...original, revision: 3, eligibleSteps: 3000 })).toBe('review_required');
    expect(evaluateRevision(original, { ...original, revision: 3, sourcePinToken: 'replacement' })).toBe('review_required');
    expect(evaluateRevision(original, { ...original, revision: 3, eligibleSteps: 7000 })).toBe('accept');
  });
});

describe('minimal strict upload schema', () => {
  it('accepts only bounded minimum real source summaries', () => expect(activitySyncSchema.parse(sync)).toEqual(sync));
  it.each(['user_id', 'userId', 'amount', 'rawSamples', 'sleep', 'heartRate', 'sourceBundleId', 'sourceName'])('rejects extra %s', (key) => expect(activitySyncSchema.safeParse({ ...sync, [key]: 'sensitive' }).success).toBe(false));
  it.each([-1, 1.5, NaN, Infinity, 100001])('rejects invalid total %s', (eligibleSteps) => expect(activitySyncSchema.safeParse({ ...sync, eligibleSteps }).success).toBe(false));
  it('requires offset, real date, revision and opaque UUID pin', () => {
    for (const update of [{ observedAt: '2026-09-18T12:00:00' }, { taskDate: '2026-02-30' }, { revision: 0 }, { sourcePinToken: 'com.apple.Health' }, { sourceCategory: 'unknown' }, { sourcePolicy: 'client-verified' }, { timezone: 'UTC' }]) expect(activitySyncSchema.safeParse({ ...sync, ...update }).success).toBe(false);
  });
  it('synthetic payloads require the explicit isolated schema', () => {
    const demo = { ...sync, sourceCategory: 'synthetic_demo', sourcePolicy: 'synthetic-demo-v1' };
    expect(activitySyncSchema.safeParse(demo).success).toBe(false);
    expect(demoActivitySyncSchema.safeParse(demo).success).toBe(true);
    expect(demoActivitySyncSchema.safeParse(sync).success).toBe(false);
  });
});
