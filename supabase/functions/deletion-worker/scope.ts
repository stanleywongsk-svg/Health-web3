// An explicit scope narrows a worker run. Invalid/empty input never broadens it.
export function deletionJobScope(value: string | undefined): ReadonlySet<string> | undefined {
  if (value === undefined) return undefined;
  const ids = value.split(',').map(id => id.trim().toLowerCase());
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (ids.length > 50 || ids.some(id => !uuid.test(id))) {
    throw new Error('Deletion job scope must contain between 1 and 50 UUIDs.');
  }
  return new Set(ids);
}

export function scopedDeletionJobs<T extends { id: string }>(jobs: T[], scope: ReadonlySet<string> | undefined): T[] {
  return scope === undefined ? jobs : jobs.filter(job => scope.has(job.id.toLowerCase()));
}
