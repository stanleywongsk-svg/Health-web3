import { deletionJobScope, scopedDeletionJobs } from './scope.ts';

const own = 'c87dc23e-a370-4a0c-918b-a0e865e516e5';
const foreign = 'c87dc23e-a370-4a0c-918b-a0e865e516e6';
function assert(value: boolean) { if (!value) throw new Error('Scope assertion failed.'); }

Deno.test('absent deletion scope retains the normal worker queue', () => {
  const jobs = [{ id: own }, { id: foreign }];
  assert(scopedDeletionJobs(jobs, deletionJobScope(undefined)) === jobs);
});
Deno.test('scoped worker excludes a foreign job added after the caller checked the queue', () => {
  const scope = deletionJobScope(own);
  const selected = scopedDeletionJobs([{ id: foreign }, { id: own }], scope);
  assert(selected.length === 1 && selected[0]?.id === own);
});
Deno.test('empty, malformed and excessive scopes fail closed without echoing input', () => {
  for (const value of ['', ' ', `${own},`, 'sensitive-invalid-input', Array(51).fill(own).join(',')]) {
    let rejected = false;
    try { deletionJobScope(value); } catch (error) {
      rejected = error instanceof Error && error.message === 'Deletion job scope must contain between 1 and 50 UUIDs.';
    }
    assert(rejected);
  }
});
Deno.test('normalized, duplicate and completed/missing job IDs cannot widen the selection', () => {
  const scope = deletionJobScope(` ${own.toUpperCase()} ,${own}`);
  assert(scope?.size === 1);
  assert(scopedDeletionJobs([{ id: foreign }], scope).length === 0);
  assert(scopedDeletionJobs([], scope).length === 0);
});
