import { epochMilliseconds, taskDayBounds } from '@healthloop/domain';
import { SOURCE_POLICY, type HeartRateSample, type MetricResult, type SleepSample, type SleepSummary, type SourcePin, type StepAggregation, type StepSample } from './types.ts';

type Interval = { start: number; end: number; count: number };
function intervalTotal(intervals: Interval[]): number {
  // Keep only the largest sample in each connected overlap group. This intentionally undercounts
  // ambiguous native revisions rather than crediting duplicated periods. Adjacent intervals can sum.
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end || b.count - a.count);
  let total = 0; let end = -Infinity; let groupMax = 0;
  for (const interval of sorted) {
    if (interval.start >= end) { total += groupMax; groupMax = interval.count; end = interval.end; }
    else { groupMax = Math.max(groupMax, interval.count); end = Math.max(end, interval.end); }
  }
  return total + groupMax;
}
const present = <T>(value: T): MetricResult<T> => ({ status: 'present', value });
const noData = <T>(): MetricResult<T> => ({ status: 'no_data' });
const invalid = <T>(reason: string): MetricResult<T> => ({ status: 'invalid', reason });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function aggregateSteps(input: { taskDate: string; samples: readonly StepSample[]; pinnedSource?: SourcePin; newPinToken?: string }): StepAggregation {
  const bounds = taskDayBounds(input.taskDate);
  const dayStart = epochMilliseconds(bounds.startAt); const dayEnd = epochMilliseconds(bounds.endAt);
  const reasons = new Set<string>();
  const groups = new Map<string, { category: StepSample['source']['category']; displayed: Interval[]; eligible: Interval[] }>();
  const seen = new Map<string, string>();
  const result = (displayed: MetricResult<number>, eligible: MetricResult<number>, pin: SourcePin | null): StepAggregation => ({ displayed, eligible, pin, excludedReasons: [...reasons].sort() });
  try {
    for (const sample of input.samples) {
      const start = epochMilliseconds(sample.startAt); const end = epochMilliseconds(sample.endAt);
      if (!sample.id || !sample.source.id || !['apple_phone', 'apple_watch', 'unknown'].includes(sample.source.category) || typeof sample.source.isManual !== 'boolean' || !Number.isSafeInteger(sample.count) || sample.count < 0 || sample.count > 100_000 || start >= end) {
        return result(invalid('malformed_sample'), invalid('malformed_sample'), input.pinnedSource ?? null);
      }
      const fingerprint = JSON.stringify([start, end, sample.count, sample.source.id, sample.source.category, sample.source.isManual]);
      if (seen.has(sample.id)) {
        if (seen.get(sample.id) !== fingerprint) return result(invalid('conflicting_sample_id'), invalid('conflicting_sample_id'), input.pinnedSource ?? null);
        reasons.add('duplicate_sample'); continue;
      }
      seen.set(sample.id, fingerprint);
      if (end <= dayStart || start >= dayEnd) continue;
      if (start < dayStart || end > dayEnd) { reasons.add('cross_day_sample'); continue; }
      const group = groups.get(sample.source.id) ?? { category: sample.source.category, displayed: [], eligible: [] };
      if (group.category !== sample.source.category) return result(invalid('conflicting_source_category'), invalid('conflicting_source_category'), input.pinnedSource ?? null);
      group.displayed.push({ start, end, count: sample.count });
      if (sample.source.isManual) reasons.add('manual_entry');
      else if (sample.source.category === 'unknown') reasons.add('unknown_source');
      else group.eligible.push({ start, end, count: sample.count });
      groups.set(sample.source.id, group);
    }
  } catch {
    return result(invalid('malformed_timestamp'), invalid('malformed_timestamp'), input.pinnedSource ?? null);
  }
  const displayedTotals = [...groups.values()].map((group) => intervalTotal(group.displayed));
  const displayed = displayedTotals.length ? present(Math.max(...displayedTotals)) : noData<number>();
  if (displayed.status === 'present' && displayed.value > 100_000) return result(invalid('daily_total_out_of_range'), invalid('daily_total_out_of_range'), input.pinnedSource ?? null);
  if (groups.size > 1) reasons.add('sources_not_added');
  let pin = input.pinnedSource ?? null;
  if (pin) {
    if (pin.sourcePolicy !== SOURCE_POLICY || !uuid.test(pin.pinToken) || !['apple_watch', 'apple_phone'].includes(pin.sourceCategory)) return result(displayed, invalid('invalid_pin'), pin);
    const group = groups.get(pin.sourceId);
    if (group && group.category !== pin.sourceCategory) return result(displayed, invalid('pinned_source_changed'), pin);
    if (!group?.eligible.length) { reasons.add('pinned_source_missing'); return result(displayed, noData(), pin); }
    return result(displayed, present(intervalTotal(group.eligible)), pin);
  }
  const eligibleSources = [...groups.entries()].filter(([, group]) => group.eligible.length > 0).sort(([aId, a], [bId, b]) => {
    const rank = (category: string) => category === 'apple_watch' ? 0 : 1;
    return rank(a.category) - rank(b.category) || (aId < bId ? -1 : aId > bId ? 1 : 0);
  });
  const selected = eligibleSources[0];
  if (!selected) return result(displayed, noData(), null);
  if (!input.newPinToken || !uuid.test(input.newPinToken)) return result(displayed, invalid('new_pin_token_required'), null);
  const [sourceId, group] = selected;
  if (group.category === 'unknown') return result(displayed, noData(), null);
  pin = { sourceId, sourceCategory: group.category, sourcePolicy: SOURCE_POLICY, pinToken: input.newPinToken };
  return result(displayed, present(intervalTotal(group.eligible)), pin);
}

/** Local-only union of sleep stages. Awake and in-bed samples are not evidence of sleep. */
export function summarizeSleep(samples: readonly SleepSample[]): MetricResult<SleepSummary> {
  const intervals: Array<{ start: number; end: number }> = [];
  for (const sample of samples) {
    try {
      const start = epochMilliseconds(sample.startAt); const end = epochMilliseconds(sample.endAt);
      if (!sample.id || start >= end || !['asleep', 'core', 'deep', 'rem', 'awake', 'in_bed'].includes(sample.stage)) return invalid('malformed_sleep_sample');
      if (sample.stage !== 'awake' && sample.stage !== 'in_bed') intervals.push({ start, end });
    } catch { return invalid('malformed_sleep_sample'); }
  }
  if (!intervals.length) return noData();
  intervals.sort((a, b) => a.start - b.start || a.end - b.end);
  const union: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const previous = union[union.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else union.push({ ...interval });
  }
  return present({
    durationMinutes: union.reduce((duration, interval) => duration + (interval.end - interval.start) / 60_000, 0),
    intervals: union.map((interval) => ({ startAt: new Date(interval.start).toISOString(), endAt: new Date(interval.end).toISOString() })),
  });
}
export function selectLatestHeartRate(samples: readonly HeartRateSample[]): MetricResult<HeartRateSample> {
  let latest: HeartRateSample | undefined;
  for (const sample of samples) {
    try {
      if (!Number.isFinite(sample.beatsPerMinute) || sample.beatsPerMinute <= 0 || sample.beatsPerMinute > 400) return invalid('malformed_heart_rate');
      const at = epochMilliseconds(sample.measuredAt);
      if (!latest || at > epochMilliseconds(latest.measuredAt)) latest = sample;
    } catch { return invalid('malformed_heart_rate'); }
  }
  return latest ? present({ ...latest }) : noData();
}
