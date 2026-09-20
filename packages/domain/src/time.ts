export const TASK_TIMEZONE = 'Asia/Hong_Kong' as const;
const DAY_MS = 86_400_000;
const OFFSET_MS = 8 * 60 * 60 * 1000;
export type Instant = string | number | Date;

export function epochMilliseconds(value: Instant): number {
  if (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new RangeError('An instant must include an explicit timezone');
  }
  const result = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(result)) throw new RangeError('Invalid instant');
  return result;
}

/** Supported task-date range has a stable UTC+08:00 Hong Kong civil offset. */
export function assertTaskDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Expected YYYY-MM-DD');
  const year = Number(value.slice(0, 4));
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (year < 2000 || year > 2100 || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new RangeError('Invalid task date; supported years are 2000–2100');
  }
}
export function taskDateAt(instant: Instant): string {
  const value = new Date(epochMilliseconds(instant) + OFFSET_MS).toISOString().slice(0, 10);
  assertTaskDate(value);
  return value;
}
export function addTaskDays(taskDate: string, days: number): string {
  assertTaskDate(taskDate);
  if (!Number.isSafeInteger(days)) throw new RangeError('Days must be an integer');
  const value = new Date(Date.parse(`${taskDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
  assertTaskDate(value);
  return value;
}
export function taskDayBounds(taskDate: string): { startAt: string; endAt: string } {
  assertTaskDate(taskDate);
  const start = Date.parse(`${taskDate}T00:00:00+08:00`);
  return { startAt: new Date(start).toISOString(), endAt: new Date(start + DAY_MS).toISOString() };
}
export function weekStart(taskDate: string): string {
  assertTaskDate(taskDate);
  const weekday = new Date(`${taskDate}T00:00:00Z`).getUTCDay();
  return addTaskDays(taskDate, -(weekday === 0 ? 6 : weekday - 1));
}
export function lateSyncCutoff(taskDate: string, cutoffHour = 12): string {
  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > 23) throw new RangeError('Invalid cutoff hour');
  return new Date(Date.parse(`${addTaskDays(taskDate, 1)}T00:00:00+08:00`) + cutoffHour * 3_600_000).toISOString();
}
/** Only a trusted server clock belongs here. Cutoff equality is closed. */
export function isBeforeCutoff(taskDate: string, serverNow: Instant, cutoffHour = 12): boolean {
  return epochMilliseconds(serverNow) < epochMilliseconds(lateSyncCutoff(taskDate, cutoffHour));
}
