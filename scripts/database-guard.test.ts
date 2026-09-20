import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('destructive database runner target guard', () => {
  it.each([
    'postgres://remote.invalid/healthloop_test_core',
    'postgres://127.0.0.1/production',
    'postgres://127.0.0.1/healthloop_test_core?host=remote.invalid',
    'postgres://127.0.0.1/healthloop_test_core#ambiguous',
    'https://127.0.0.1/healthloop_test_core',
  ])('refuses %s before creating a connection', (target) => {
    const result = spawnSync(process.execPath, ['supabase/tests/run.mjs'], {
      encoding: 'utf8',
      env: { ...process.env, HEALTHLOOP_TEST_DATABASE_URL: target, HEALTHLOOP_ALLOW_DB_RESET: 'local-only' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Refusing reset');
    expect(result.stdout).not.toContain('PASS');
  });
});
