import { requireOptionalNativeModule } from 'expo-modules-core';
export interface NativeSample {
  id: string; startAt: string; endAt: string; value: number;
  source: { id: string; name: string; category: 'apple_watch' | 'apple_phone' | 'unknown'; isManual: boolean };
}
export type HealthMetric = 'steps' | 'sleep' | 'heartRate';
export interface NativeHealthModule {
  isAvailable(): boolean;
  requestRead(metrics: HealthMetric[]): Promise<void>;
  query(metric: HealthMetric, startMs: number, endMs: number): Promise<NativeSample[]>;
  cancelAll(): void;
}
// An absent module is an unavailable platform, never a synthetic-data fallback.
export default requireOptionalNativeModule<NativeHealthModule>('HealthLoopHealth');
