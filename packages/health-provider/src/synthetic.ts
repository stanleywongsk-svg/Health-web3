/** Synthetic tests/demo only. Never imported by the real native adapter. */
import type { HealthAccessState, HealthDataProvider, HeartRateSample, MetricResult, SleepSample, StepSample } from './types.ts';
export const SYNTHETIC_BANNER = '演示模式：模拟数据，不产生真实奖励';
export class SyntheticHealthProvider implements HealthDataProvider {
  readonly mode = 'synthetic_demo';
  private requested = false;
  constructor(private readonly fixtures: { steps: Record<string, StepSample[]>; sleep?: SleepSample[]; heartRate?: HeartRateSample }) {}
  async getAccessState(): Promise<HealthAccessState> { return { platform: 'available', accessRequested: this.requested }; }
  async requestReadAccess(): Promise<HealthAccessState> { this.requested = true; return this.getAccessState(); }
  async readSteps(taskDate: string, signal?: AbortSignal): Promise<MetricResult<StepSample[]>> {
    if (signal?.aborted) return { status: 'error', code: 'cancelled' };
    const value = this.fixtures.steps[taskDate];
    return value?.length ? { status: 'present', value: structuredClone(value) } : { status: 'no_data' };
  }
  async readSleep(_startAt: string, _endAt: string, signal?: AbortSignal): Promise<MetricResult<SleepSample[]>> {
    if (signal?.aborted) return { status: 'error', code: 'cancelled' };
    const value = this.fixtures.sleep;
    return value?.length ? { status: 'present', value: structuredClone(value) } : { status: 'no_data' };
  }
  async readLatestHeartRate(signal?: AbortSignal): Promise<MetricResult<HeartRateSample>> {
    if (signal?.aborted) return { status: 'error', code: 'cancelled' };
    return this.fixtures.heartRate ? { status: 'present', value: { ...this.fixtures.heartRate } } : { status: 'no_data' };
  }
}
