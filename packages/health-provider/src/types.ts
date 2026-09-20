export type SourceCategory = 'apple_phone' | 'apple_watch' | 'unknown';
export type ApprovedSourceCategory = Exclude<SourceCategory, 'unknown'>;
export const SOURCE_POLICY = 'single-approved-source-v1' as const;

/** Raw IDs in this contract are LOCAL ONLY. Never put samples or source IDs in sync requests. */
export interface StepSample {
  id: string;
  startAt: string;
  endAt: string;
  count: number;
  source: { id: string; category: SourceCategory; isManual: boolean };
}
export interface SourcePin {
  sourceId: string;
  sourceCategory: ApprovedSourceCategory;
  sourcePolicy: typeof SOURCE_POLICY;
  /** Random app-issued token; this is the only source identity allowed in a daily upload. */
  pinToken: string;
}
export type MetricResult<T> =
  | { status: 'present'; value: T }
  | { status: 'no_data' }
  | { status: 'unavailable' }
  | { status: 'invalid'; reason: string }
  | { status: 'error'; code: 'cancelled' | 'query_failed' | 'not_requested' };

export interface StepAggregation {
  displayed: MetricResult<number>;
  eligible: MetricResult<number>;
  pin: SourcePin | null;
  excludedReasons: string[];
}
export interface SleepSample {
  id: string;
  startAt: string;
  endAt: string;
  stage: 'asleep' | 'core' | 'deep' | 'rem' | 'awake' | 'in_bed';
}
export interface SleepSummary {
  durationMinutes: number;
  intervals: Array<{ startAt: string; endAt: string }>;
}
export interface HeartRateSample { beatsPerMinute: number; measuredAt: string }

/** requested is the app's request history, never a claim about granted read permission. */
export interface HealthAccessState {
  platform: 'available' | 'unavailable';
  accessRequested: boolean;
}
export type HealthReadType = 'steps' | 'sleep' | 'heart_rate';
export interface HealthDataProvider {
  getAccessState(): Promise<HealthAccessState>;
  requestReadAccess(types: readonly HealthReadType[]): Promise<HealthAccessState>;
  readSteps(taskDate: string, signal?: AbortSignal): Promise<MetricResult<StepSample[]>>;
  readSleep(startAt: string, endAt: string, signal?: AbortSignal): Promise<MetricResult<SleepSample[]>>;
  readLatestHeartRate(signal?: AbortSignal): Promise<MetricResult<HeartRateSample>>;
}
