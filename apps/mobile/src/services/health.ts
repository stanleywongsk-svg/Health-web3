import { Platform } from 'react-native';
import { selectLatestHeartRate } from '@healthloop/health-provider';
import type { HealthDataProvider, HealthAccessState, HealthReadType, MetricResult, StepSample, SleepSample, HeartRateSample } from '@healthloop/health-provider';
import NativeHealth, { type HealthMetric } from '../../modules/healthloop-health/src/HealthLoopHealthModule';

const nativeType = (type: HealthReadType): HealthMetric => type === 'heart_rate' ? 'heartRate' : type;
export class IOSHealthProvider implements HealthDataProvider {
  private requested = false;
  private sourceLabels: Partial<Record<HealthMetric,string[]>> = {};
  getSourceLabels(metric: HealthMetric) { return this.sourceLabels[metric] ?? []; }
  clearSourceLabels() { this.sourceLabels={}; }
  async getAccessState(): Promise<HealthAccessState> { return { platform: Platform.OS === 'ios' && NativeHealth?.isAvailable() ? 'available' : 'unavailable', accessRequested: this.requested }; }
  async requestReadAccess(types: readonly HealthReadType[]): Promise<HealthAccessState> {
    if ((await this.getAccessState()).platform === 'unavailable') return this.getAccessState();
    await NativeHealth!.requestRead(types.map(nativeType)); this.requested = true;
    return this.getAccessState();
  }
  cancel() { NativeHealth?.cancelAll(); }
  private async read(metric: HealthMetric, startAt: string, endAt: string, signal?: AbortSignal) {
    if ((await this.getAccessState()).platform === 'unavailable') return { status: 'unavailable' as const };
    if (signal?.aborted) return { status: 'error' as const, code: 'cancelled' as const };
    const cancel = () => NativeHealth?.cancelAll(); signal?.addEventListener('abort', cancel, { once: true });
    try {
      const rows = await NativeHealth!.query(metric, Date.parse(startAt), Date.parse(endAt));
      if (signal?.aborted) return { status: 'error' as const, code: 'cancelled' as const };
      this.sourceLabels[metric]=[...new Set(rows.map(row=>row.source.name))];
      return rows.length ? { status: 'present' as const, value: rows } : { status: 'no_data' as const };
    } catch { return { status: 'error' as const, code: signal?.aborted ? 'cancelled' as const : 'query_failed' as const }; }
    finally { signal?.removeEventListener('abort', cancel); }
  }
  async readSteps(taskDate: string, signal?: AbortSignal): Promise<MetricResult<StepSample[]>> {
    const start = new Date(taskDate + 'T00:00:00+08:00');
    const result = await this.read('steps', start.toISOString(), new Date(+start + 86400000).toISOString(), signal);
    return result.status === 'present' ? { status: 'present', value: result.value.map(row => ({ ...row, count: row.value })) } : result;
  }
  async readSleep(startAt: string, endAt: string, signal?: AbortSignal): Promise<MetricResult<SleepSample[]>> {
    const result = await this.read('sleep', startAt, endAt, signal);
    if (result.status !== 'present') return result;
    const stages = ['in_bed', 'asleep', 'awake', 'core', 'deep', 'rem'] as const;
    const rows = result.value.flatMap(row => {
      const stage = stages[row.value];
      return stage ? [{ id: row.id, startAt: row.startAt, endAt: row.endAt, stage }] : [];
    });
    return rows.length ? { status: 'present', value: rows } : { status: 'no_data' };
  }
  async readLatestHeartRate(signal?: AbortSignal): Promise<MetricResult<HeartRateSample>> {
    const end = new Date(); const result = await this.read('heartRate', new Date(+end - 7 * 86400000).toISOString(), end.toISOString(), signal);
    if (result.status !== 'present') return result;
    return selectLatestHeartRate(result.value.map(row=>({beatsPerMinute:row.value,measuredAt:row.endAt})));
  }
}
export const health = new IOSHealthProvider();
