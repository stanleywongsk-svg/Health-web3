import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, statfs } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateEnvironment } from '../apps/mobile/src/utils/environment.ts';

type CommandResult = { status: 'ok' | 'error' | 'timeout' | 'unavailable'; code: number | null; output: string };
type Check = { id: string; status: 'pass' | 'fail' | 'info'; detail: string };
type Runner = (command: string, args: string[], timeoutMs?: number) => Promise<CommandResult>;

/** Read-only probes: bound both execution time and captured output; kill only our child group. */
export const runBounded: Runner = (command, args, timeoutMs = 12_000) => new Promise(resolveResult => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let output = ''; let settled = false;
  const capture = (chunk: Buffer) => { output = (output + chunk.toString()).slice(0, 65_536); };
  child.stdout.on('data', capture); child.stderr.on('data', capture);
  const stop = () => {
    if (!child.pid) return;
    try { if (process.platform === 'win32') child.kill('SIGKILL'); else process.kill(-child.pid, 'SIGKILL'); } catch { /* Child already exited. */ }
  };
  const complete = (result: CommandResult) => { if (settled) return; settled = true; clearTimeout(timer); resolveResult(result); };
  const timer = setTimeout(() => { stop(); complete({ status: 'timeout', code: null, output: '' }); }, timeoutMs);
  child.on('error', () => complete({ status: 'unavailable', code: null, output: '' }));
  child.on('close', code => complete({ status: code === 0 ? 'ok' : 'error', code, output }));
});

export function checkDeviceEnvironment(source: string): Check {
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?(EXPO_PUBLIC_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]!] = match[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  try {
    const env = validateEnvironment(values);
    const key = env.anonKey;
    if (!/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key) && !/^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error('PUBLIC_KEY_FORMAT');
    const host = new URL(env.supabaseUrl).hostname;
    if (['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new Error('DEVICE_LOOPBACK');
    return { id: 'device-config', status: 'pass', detail: 'Real-data configuration structure is valid; key validity and device-to-server connectivity are not tested.' };
  } catch {
    return { id: 'device-config', status: 'fail', detail: 'Check real mode, environment, public client key and matching API origins. A physical iPhone must not use localhost/127.0.0.1. Values are intentionally not printed.' };
  }
}

export async function nativeCheck(options: {
  cwd?: string; envFile?: string; platform?: string; nodeVersion?: string;
  run?: Runner; exists?: (path: string) => boolean; read?: (path: string) => Promise<string>; freeBytes?: () => Promise<number>;
} = {}) {
  const cwd = options.cwd ?? process.cwd(); const run = options.run ?? runBounded; const exists = options.exists ?? existsSync;
  const checks: Check[] = []; const add = (id: string, status: Check['status'], detail: string) => checks.push({ id, status, detail });
  const platform = options.platform ?? process.platform;
  const version = (options.nodeVersion ?? process.versions.node).split('.').map(Number);
  add('node', version[0] === 24 && (version[1] ?? 0) >= 19 ? 'pass' : 'fail', 'This repository requires Node 24.19 or newer in the 24.x line.');
  add('checkout-path', /\s/.test(cwd) ? 'fail' : 'pass', 'Use a checkout without spaces; the pinned React Native prebuilt Pods previously rejected a space-containing path.');
  if (options.envFile) {
    try { checks.push(checkDeviceEnvironment(await (options.read ?? (path => readFile(path, 'utf8')))(resolve(cwd, options.envFile)))); }
    catch { add('device-config', 'fail', 'The selected environment file could not be read. No values were printed.'); }
  } else add('device-config', 'info', 'Not checked. Add --env-file apps/mobile/.env to validate physical-device configuration without printing values.');
  if (platform !== 'darwin') {
    add('macos', 'fail', 'Local iOS compilation requires macOS and Xcode.');
    return { ok: false, checks };
  }
  try {
    const bytes = await (options.freeBytes ?? (async () => { const disk = await statfs(cwd); return disk.bavail * disk.bsize; }))();
    add('disk', bytes >= 30 * 2 ** 30 ? 'pass' : 'fail', `${Math.floor(bytes / 2 ** 30)} GiB available; project build-headroom recommendation is 30 GiB (not an Apple minimum).`);
  } catch { add('disk', 'fail', 'Unable to inspect build disk free space.'); }

  const probes = await Promise.all([
    run('/usr/bin/xcode-select', ['-p']), run('/usr/bin/xcodebuild', ['-version']),
    run('/usr/bin/xcodebuild', ['-checkFirstLaunchStatus']), run('/usr/bin/xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']),
    run('pod', ['--version']), run('/usr/sbin/pkgutil', ['--pkg-info', 'com.apple.pkg.XcodeSystemResources']),
    run('/bin/ps', ['-axo', 'args=']),
  ]);
  const [selected, xcode, firstLaunch, sdk, pod, receipt, processes] = probes as [CommandResult, CommandResult, CommandResult, CommandResult, CommandResult, CommandResult, CommandResult];
  add('xcode-select', selected.status === 'ok' && selected.output.trim().endsWith('/Contents/Developer') ? 'pass' : 'fail', 'The active developer directory must be a full Xcode installation.');
  add('xcode-version', xcode.status === 'ok' ? 'pass' : 'fail', xcode.output.match(/^Xcode \d+(?:\.\d+)*/m)?.[0] ?? `Xcode version probe: ${xcode.status}.`);
  add('first-launch', firstLaunch.status === 'ok' ? 'pass' : 'fail', `Read-only first-launch status: ${firstLaunch.status}; exit ${firstLaunch.code ?? 'none'}. An operator must complete setup if this fails.`);
  add('iphoneos-sdk', sdk.status === 'ok' ? 'pass' : 'fail', sdk.output.trim().match(/^\d+(?:\.\d+)+$/)?.[0] ? 'iPhoneOS SDK is discoverable.' : `SDK probe: ${sdk.status}.`);
  add('cocoapods', pod.status === 'ok' ? 'pass' : 'fail', pod.output.trim().match(/^\d+(?:\.\d+)+$/)?.[0] ? 'CocoaPods is available.' : `CocoaPods probe: ${pod.status}.`);
  add('system-resource-receipt', receipt.status === 'ok' ? 'pass' : 'fail', 'XcodeSystemResources package receipt must be installed by the supported Xcode setup process.');
  const framework = '/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/CoreSimulator';
  const coreSimulator = exists(framework);
  add('coresimulator-framework', coreSimulator ? 'pass' : 'fail', coreSimulator ? 'Required CoreSimulator system framework exists.' : 'Required CoreSimulator system framework is missing; no native source compilation is proven.');
  if (coreSimulator) {
    const simulator = await run('/usr/bin/xcrun', ['simctl', 'list', 'runtimes', '--json']);
    add('simctl', simulator.status === 'ok' ? 'pass' : 'fail', `Simulator service probe: ${simulator.status}. Runtime/device identifiers are not printed.`);
  } else add('simctl', 'info', 'Skipped because its required system framework is missing; this is not a passing simulator check.');
  const firstLaunchCount = processes.output.split(/\r?\n/).filter(line => /^\S*xcodebuild\s/.test(line.trim()) && /(?:^|\s)-runFirstLaunch(?:\s|$)/.test(line)).length;
  add('first-launch-processes', 'info', processes.status === 'ok' ? `${firstLaunchCount} existing first-launch process(es); do not stack installers or terminate unrelated processes.` : 'Process inspection unavailable; no process was modified.');
  return { ok: checks.every(check => check.status !== 'fail'), checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--env-file')) {
    process.stderr.write('Usage: node scripts/native-check.ts [--env-file apps/mobile/.env]\n'); process.exitCode = 2;
  } else {
    const result = await nativeCheck({ envFile: args[1] });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exitCode = result.ok ? 0 : 1;
  }
}
