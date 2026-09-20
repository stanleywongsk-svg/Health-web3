import { describe, expect, it, vi } from 'vitest';
import { aggregateSteps, ConsentUploadCoordinator, selectLatestHeartRate, SOURCE_POLICY, summarizeSleep, UploadCancelledError, type StepSample } from './index.ts';
const taskDate = '2026-09-18';
const token = 'a18803d0-6467-4703-b86f-f272b4afda38';
function sample(id: string, count: number, overrides: Partial<StepSample> = {}): StepSample {
  return { id, count, startAt: '2026-09-18T08:00:00+08:00', endAt: '2026-09-18T09:00:00+08:00', source: { id: 'watch-local-only', category: 'apple_watch', isManual: false }, ...overrides };
}
const aggregate = (samples: StepSample[]) => aggregateSteps({ taskDate, samples, newPinToken: token });

describe('conservative day-pinned source aggregation', () => {
  it('never adds phone and watch overlapping counts', () => {
    const result = aggregate([sample('watch', 3000), sample('phone', 5000, { source: { id: 'phone', category: 'apple_phone', isManual: false } })]);
    expect(result.displayed).toEqual({ status: 'present', value: 5000 });
    expect(result.eligible).toEqual({ status: 'present', value: 3000 });
    expect(result.pin?.sourceCategory).toBe('apple_watch');
    expect(result.excludedReasons).toContain('sources_not_added');
  });
  it('does not merge partial overlap or disjoint periods across sources', () => {
    const phone = sample('phone', 5000, { startAt: '2026-09-18T08:30:00+08:00', endAt: '2026-09-18T12:00:00+08:00', source: { id: 'phone', category: 'apple_phone', isManual: false } });
    expect(aggregate([sample('watch', 3000), phone]).eligible).toEqual({ status: 'present', value: 3000 });
    phone.startAt = '2026-09-18T10:00:00+08:00';
    expect(aggregate([sample('watch', 3000), phone]).eligible).toEqual({ status: 'present', value: 3000 });
  });
  it('uses a stable source choice independent of input order or highest count', () => {
    const a = sample('a', 1000, { source: { id: 'a', category: 'apple_watch', isManual: false } });
    const z = sample('z', 7000, { source: { id: 'z', category: 'apple_watch', isManual: false } });
    expect(aggregate([z, a]).pin).toEqual(aggregate([a, z]).pin);
    expect(aggregate([z, a]).eligible).toEqual({ status: 'present', value: 1000 });
  });
  it('preserves a phone pin if a watch appears, and never falls back from missing source', () => {
    const phone = sample('phone', 3000, { source: { id: 'phone', category: 'apple_phone', isManual: false } });
    const pin = aggregate([phone]).pin!;
    expect(aggregateSteps({ taskDate, samples: [phone, sample('watch', 7000)], pinnedSource: pin }).eligible).toEqual({ status: 'present', value: 3000 });
    const changed = aggregateSteps({ taskDate, samples: [sample('replacement', 7000)], pinnedSource: pin });
    expect(changed.eligible).toEqual({ status: 'no_data' }); expect(changed.pin).toEqual(pin);
  });
  it('shows manual/unknown values without crediting them', () => {
    const result = aggregate([sample('manual', 7000, { source: { id: 'manual', category: 'apple_watch', isManual: true } }), sample('unknown', 6000, { source: { id: 'unknown', category: 'unknown', isManual: false } })]);
    expect(result.displayed).toEqual({ status: 'present', value: 7000 }); expect(result.eligible).toEqual({ status: 'no_data' }); expect(result.pin).toBeNull();
    expect(result.excludedReasons).toContain('manual_entry'); expect(result.excludedReasons).toContain('unknown_source');
  });
  it('excludes manual samples even from an otherwise approved recording source', () => {
    const result = aggregate([sample('valid', 3000), sample('manual', 9000, { source: { id: 'watch-local-only', category: 'apple_watch', isManual: true } })]);
    expect(result.eligible).toEqual({ status: 'present', value: 3000 });
  });
  it('deduplicates identical sample IDs and rejects conflicting revisions', () => {
    const original = sample('same', 3000);
    expect(aggregate([original, original]).eligible).toEqual({ status: 'present', value: 3000 });
    expect(aggregate([original, { ...original, count: 5000 }]).eligible.status).toBe('invalid');
  });
  it('conservatively takes largest interval within connected overlap and sums adjacent samples', () => {
    const result = aggregate([sample('1', 2000), sample('2', 3000, { startAt: '2026-09-18T08:30:00+08:00', endAt: '2026-09-18T09:30:00+08:00' }), sample('3', 1000, { startAt: '2026-09-18T09:30:00+08:00', endAt: '2026-09-18T10:00:00+08:00' })]);
    expect(result.eligible).toEqual({ status: 'present', value: 4000 });
  });
  it('does not prorate samples crossing task-day boundaries', () => {
    const result = aggregate([sample('cross', 7000, { startAt: '2026-09-17T23:59:00+08:00', endAt: '2026-09-18T00:01:00+08:00' })]);
    expect(result.eligible.status).toBe('no_data'); expect(result.excludedReasons).toContain('cross_day_sample');
  });
  it('distinguishes actual zero, missing and invalid data', () => {
    expect(aggregate([sample('zero', 0)]).eligible).toEqual({ status: 'present', value: 0 });
    expect(aggregate([]).eligible).toEqual({ status: 'no_data' });
    expect(aggregate([sample('nan', NaN)]).eligible.status).toBe('invalid');
  });
  it.each([-1, Infinity, 1.2, 100001])('rejects malformed counts %s', (count) => expect(aggregate([sample('x', count)]).eligible.status).toBe('invalid'));
  it('rejects malformed instants, inconsistent source metadata and unusable pins', () => {
    expect(aggregate([sample('x', 3000, { startAt: 'not-an-instant' })]).eligible.status).toBe('invalid');
    expect(aggregate([sample('x', 3000), sample('y', 5000, { source: { id: 'watch-local-only', category: 'apple_phone', isManual: false } })]).eligible.status).toBe('invalid');
    expect(aggregateSteps({ taskDate, samples: [sample('x', 3000)] }).eligible.status).toBe('invalid');
    expect(aggregateSteps({ taskDate, samples: [sample('x', 3000)], pinnedSource: { sourceId: 'watch-local-only', sourceCategory: 'apple_phone', sourcePolicy: SOURCE_POLICY, pinToken: token } }).eligible.status).toBe('invalid');
  });
});

describe('optional on-device sleep and heart rate', () => {
  it('unions overlapping stages and sources instead of doubling duration', () => {
    const result = summarizeSleep([
      { id: 'a', startAt: '2026-09-17T22:00:00+08:00', endAt: '2026-09-18T06:00:00+08:00', stage: 'asleep' },
      { id: 'b', startAt: '2026-09-17T23:00:00+08:00', endAt: '2026-09-18T02:00:00+08:00', stage: 'deep' },
      { id: 'c', startAt: '2026-09-18T05:00:00+08:00', endAt: '2026-09-18T07:00:00+08:00', stage: 'rem' },
      { id: 'd', startAt: '2026-09-17T20:00:00+08:00', endAt: '2026-09-18T08:00:00+08:00', stage: 'in_bed' },
    ]);
    expect(result).toEqual({ status: 'present', value: { durationMinutes: 540, intervals: [{ startAt: '2026-09-17T14:00:00.000Z', endAt: '2026-09-17T23:00:00.000Z' }] } });
  });
  it('keeps gaps between separate sleep sessions', () => {
    const result = summarizeSleep([{ id: 'a', startAt: '2026-09-18T00:00:00Z', endAt: '2026-09-18T01:00:00Z', stage: 'core' }, { id: 'b', startAt: '2026-09-18T02:00:00Z', endAt: '2026-09-18T03:00:00Z', stage: 'rem' }]);
    expect(result.status === 'present' && result.value.durationMinutes).toBe(120);
    expect(result.status === 'present' && result.value.intervals.length).toBe(2);
  });
  it('does not invent a missing night and rejects reversed intervals', () => {
    expect(summarizeSleep([])).toEqual({ status: 'no_data' });
    expect(summarizeSleep([{ id: 'a', startAt: '2026-09-18T01:00:00Z', endAt: '2026-09-18T00:00:00Z', stage: 'deep' }]).status).toBe('invalid');
  });
  it('keeps last measurement timestamp, never presents stale values as live', () => {
    const recent = { beatsPerMinute: 65, measuredAt: '2026-09-16T12:00:00Z' };
    expect(selectLatestHeartRate([recent, { beatsPerMinute: 68, measuredAt: '2026-09-15T12:00:00Z' }])).toEqual({ status: 'present', value: recent });
    expect(selectLatestHeartRate([])).toEqual({ status: 'no_data' });
    expect(selectLatestHeartRate([{ beatsPerMinute: 0, measuredAt: recent.measuredAt }]).status).toBe('invalid');
  });
});

describe('consent withdrawal and account change stop upload queues', () => {
  it('does not start any operation before explicit consent', async () => {
    const coordinator = new ConsentUploadCoordinator(); const upload = vi.fn();
    await expect(coordinator.enqueue(upload)).rejects.toBeInstanceOf(UploadCancelledError); expect(upload).not.toHaveBeenCalled();
  });
  it('immediately aborts current transport and rejects queued operations without sending', async () => {
    const coordinator = new ConsentUploadCoordinator(); coordinator.setConsent(true);
    let activeSignal: AbortSignal | undefined;
    const first = coordinator.enqueue(async (signal) => { activeSignal = signal; return new Promise(() => {}); }).catch((error: unknown) => error);
    const queuedFn = vi.fn(async () => 'must-not-send');
    const second = coordinator.enqueue(queuedFn).catch((error: unknown) => error);
    coordinator.setConsent(false);
    expect(activeSignal?.aborted).toBe(true);
    expect(await first).toBeInstanceOf(UploadCancelledError); expect(await second).toBeInstanceOf(UploadCancelledError); expect(queuedFn).not.toHaveBeenCalled();
    coordinator.setConsent(true);
    expect(await coordinator.enqueue(async () => 'new-consent-work')).toBe('new-consent-work');
  });
  it('serializes operations and clears work on account switch', async () => {
    const coordinator = new ConsentUploadCoordinator(); coordinator.setConsent(true);
    const order: number[] = [];
    const first = coordinator.enqueue(async () => { order.push(1); await Promise.resolve(); order.push(2); return 1; });
    const second = coordinator.enqueue(async () => { order.push(3); return 2; });
    expect(await Promise.all([first, second])).toEqual([1, 2]); expect(order).toEqual([1, 2, 3]);
    coordinator.cancelAll(); await expect(coordinator.enqueue(async () => 3)).rejects.toBeInstanceOf(UploadCancelledError);
  });
  it('propagates network failures instead of fabricating success', async () => {
    const coordinator = new ConsentUploadCoordinator(); coordinator.setConsent(true);
    await expect(coordinator.enqueue(async () => { throw new Error('network-failure'); })).rejects.toThrow('network-failure');
    expect(await coordinator.enqueue(async () => 'retry')).toBe('retry');
  });
});
