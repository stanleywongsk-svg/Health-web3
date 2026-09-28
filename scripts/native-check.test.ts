import { describe, expect, it } from 'vitest';
import { checkDeviceEnvironment, nativeCheck, runBounded } from './native-check.ts';

const configuration = (url = 'http://192.168.1.2:54321', key = 'sb_publishable_synthetic_test_placeholder') => `EXPO_PUBLIC_APP_ENV=development\nEXPO_PUBLIC_DATA_MODE=real\nEXPO_PUBLIC_SUPABASE_URL=${url}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${key}\nEXPO_PUBLIC_CORE_API_URL=${url}/functions/v1/core`;
describe('read-only native preflight', () => {
  it('bounds a hung child process without leaking its output', async () => {
    const result = await runBounded(process.execPath, ['-e', 'process.stdout.write("private-probe-output");setInterval(()=>{},1000)'], 50);
    expect(result).toEqual({ status: 'timeout', code: null, output: '' });
  });
  it('reports a missing executable without throwing or printing paths from errors', async () => {
    expect(await runBounded('/definitely-missing-healthloop-probe', [])).toEqual({ status: 'unavailable', code: null, output: '' });
  });
  it('fails closed on incomplete first-launch installation and skips a predictably broken simulator probe', async () => {
    const calls: string[][] = [];
    const result = await nativeCheck({ cwd: '/repo', platform: 'darwin', nodeVersion: '24.19.0', exists: () => false, freeBytes: async () => 100 * 2 ** 30,
      run: async (_command, args) => { calls.push(args); return args.includes('-checkFirstLaunchStatus') ? { status: 'error', code: 69, output: 'sensitive-output' } : { status: 'ok', code: 0, output: args[0] === '-p' ? '/Applications/Xcode.app/Contents/Developer' : '26.3' }; },
    });
    expect(result.ok).toBe(false); expect(result.checks.find(row => row.id === 'first-launch')?.status).toBe('fail');
    expect(result.checks.find(row => row.id === 'coresimulator-framework')?.status).toBe('fail'); expect(calls.some(args => args.includes('simctl'))).toBe(false);
    expect(JSON.stringify(result)).not.toContain('sensitive-output'); expect(calls.flat()).not.toContain('-runFirstLaunch'); expect(calls.flat()).not.toContain('-license');
  });
  it('rejects unsupported hosts without spawning Apple tools', async () => {
    let called = false; const result = await nativeCheck({ cwd: '/repo', platform: 'linux', nodeVersion: '24.19.0', run: async () => { called = true; throw new Error(); } });
    expect(result.ok).toBe(false); expect(called).toBe(false);
  });
  it('validates physical-device config without outputting client keys or addresses', () => {
    const result = checkDeviceEnvironment(configuration()); expect(result.status).toBe('pass'); expect(JSON.stringify(result)).not.toContain('synthetic_test_placeholder'); expect(JSON.stringify(result)).not.toContain('192.168');
  });
  it.each([
    configuration('http://127.0.0.1:54321'), configuration('http://localhost.evil:54321'), configuration('https://example.com', 'sb_secret_never-print-this'),
    configuration().replace('DATA_MODE=real', 'DATA_MODE=synthetic'), configuration().replace('/functions/v1/core', '/functions/v1/other'), configuration('https://example.com', 'placeholder'),
  ])('rejects unsafe, placeholder or unreachable-from-device configuration', source => { expect(checkDeviceEnvironment(source).status).toBe('fail'); });
});
