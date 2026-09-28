#!/usr/bin/env node
/** Local CLI compatibility wrapper; never resets data or changes global Docker settings. */
import { spawn } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, open, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { constants, writeSync } from 'node:fs';
import { dirname, delimiter, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { assertLoopbackContainers, PROJECT_ID, NETWORK_ID } from './docker-loopback.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const excludes = 'studio,postgres-meta,realtime,storage-api,imgproxy,logflare,vector,supavisor';
const supportedVersion = '2.117.0';
const inspectFormat = '{"name":{{json .Name}},"projectLabel":{{json (index .Config.Labels "com.supabase.cli.project")}},"bindings":{{json .HostConfig.PortBindings}},"ports":{{json .NetworkSettings.Ports}},"networks":{{json .NetworkSettings.Networks}},"running":{{json .State.Running}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}}}';
const fail = (message) => { throw new Error(message); };

export function filterCliLine(line) {
  const plain = line.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g'), '');
  if (/eyJ[A-Za-z0-9_-]*\.|sb_(?:secret|publishable)_|postgres(?:ql)?:\/\/|\b(?:keys?|tokens?|passwords?|secrets?|credentials?|connection\s+strings?)\b/i.test(plain)) return '[credential-bearing line omitted]';
  return plain;
}

/** Buffer one bounded line so split stream chunks never write part of a credential. */
export function createCliLogFilter(writeLine) {
  let pending = ''; let dropping = false;
  return {
    write(chunk) {
      const parts = chunk.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (!dropping) pending += parts[i];
        if (pending.length > 8_192) { pending = ''; dropping = true; }
        if (i < parts.length - 1) {
          writeLine(dropping ? '[oversized CLI line omitted]' : filterCliLine(pending));
          pending = ''; dropping = false;
        }
      }
    },
    end() {
      if (pending || dropping) writeLine(dropping ? '[oversized CLI line omitted]' : filterCliLine(pending));
      pending = ''; dropping = false;
    },
  };
}

export function validateLocalConfig(text) {
  let section = '';
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line);
    if (header) { section = header[1]; continue; }
    const match = /^\s*([a-z_]+)\s*=\s*("[^"]*"|\d+|true|false)\s*(?:#.*)?$/.exec(line);
    if (!match) continue;
    const key = `${section}.${match[1]}`;
    if (values.has(key)) fail('Duplicate local backend configuration.');
    values.set(key, match[2]);
  }
  for (const [key, expected] of [['.project_id', `"${PROJECT_ID}"`], ['api.port', '54321'], ['db.port', '54322']]) {
    if (values.get(key) !== expected) fail('Only the fixed healthloop-local-dev stack is supported.');
  }
  const mailSection = values.has('local_smtp.port') ? 'local_smtp' : 'inbucket';
  if (values.get(`${mailSection}.port`) !== '54324' || values.get(`${mailSection}.enabled`) !== 'true') fail('Local Mailpit must be enabled on port 54324.');
  if (values.get('api.tls.enabled') === 'true') fail('This local adapter expects the fixed HTTP gateway port.');
}

export function validateServeEnv(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const pair = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (!pair || values.has(pair[1])) fail('Invalid local core environment file.');
    let value = pair[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values.set(pair[1], value);
  }
  const allowed = new Set(['HEALTHLOOP_ENV', 'HEALTHLOOP_BUILD_MODE', 'HEALTHLOOP_PROJECT_LABEL', 'HEALTHLOOP_ALLOWED_ORIGINS']);
  if ([...values.keys()].some((key) => !allowed.has(key)) || values.get('HEALTHLOOP_ENV') !== 'test' || values.get('HEALTHLOOP_BUILD_MODE') !== 'real' || values.get('HEALTHLOOP_PROJECT_LABEL') !== PROJECT_ID) fail('Serve requires a test/real core environment for healthloop-local-dev; credentials are injected by the CLI.');
  for (const origin of (values.get('HEALTHLOOP_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean)) {
    let url;
    try { url = new URL(origin); } catch { fail('Invalid local CORS origin.'); }
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || origin !== url.origin) fail('Only exact loopback CORS origins are allowed.');
  }
}

async function executable(name) {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory || directory.includes('docker-loopback-')) continue;
    const candidate = join(directory, name);
    try { await access(candidate, constants.X_OK); return await realpath(candidate); } catch { /* continue */ }
  }
  return fail('A real Docker executable must be available outside the project shim.');
}

async function capture(command, args, env, timeout = 30_000) {
  return await new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'ignore'] });
    let output = ''; let tooLarge = false;
    child.stdout.on('data', (chunk) => {
      if (output.length + chunk.length > 2_000_000) { tooLarge = true; child.kill('SIGTERM'); } else output += chunk.toString();
    });
    let killTimer;
    const timer = setTimeout(() => { child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000); }, timeout);
    child.once('error', () => { clearTimeout(timer); clearTimeout(killTimer); reject(new Error('Local backend command could not start.')); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      if (code !== 0 || tooLarge) reject(new Error('Local backend verification command failed.'));
      else accept(output.trim());
    });
  });
}

async function ownedContainers(docker, env) {
  const listed = await capture(docker, ['ps', '-a', '--filter', `name=^/supabase_[a-z0-9_]+_${PROJECT_ID}$`, '--format', '{{.ID}}'], env);
  const ids = listed ? listed.split(/\r?\n/) : [];
  if (ids.some((id) => !/^[a-f0-9]{12,64}$/.test(id))) fail('Unexpected Docker container identity.');
  if (!ids.length) return { ids, containers: [] };
  const raw = await capture(docker, ['inspect', '--format', inspectFormat, ...ids], env);
  const containers = raw.split(/\r?\n/).map((line) => JSON.parse(line));
  if (containers.some((item) => item.projectLabel !== PROJECT_ID)) fail('A matching Docker name is not owned by this project.');
  return { ids, containers };
}

export function validateNetworkMetadata(info) {
  const owned = info.projectLabel === PROJECT_ID || info.legacyLabel === 'local-synthetic';
  if (!owned || info.name !== NETWORK_ID || info.driver !== 'bridge' || info.options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') fail('The existing project network does not match the local-only policy.');
  const ids = Object.keys(info.containers ?? {});
  if (ids.some((id) => !/^[a-f0-9]{64}$/.test(id))) fail('Unexpected attached Docker container identity.');
  return ids;
}

async function network(docker, env, create) {
  const names = await capture(docker, ['network', 'ls', '--filter', `name=^${NETWORK_ID}$`, '--format', '{{.Name}}'], env);
  if (!names) {
    if (!create) fail('The project Docker network does not exist. Run local-backend start first.');
    await capture(docker, ['network', 'create', '--driver', 'bridge', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', '--label', `healthloop.project=${PROJECT_ID}`, NETWORK_ID], env);
  }
  const raw = await capture(docker, ['network', 'inspect', '--format', '{"name":{{json .Name}},"driver":{{json .Driver}},"options":{{json .Options}},"projectLabel":{{json (index .Labels "healthloop.project")}},"legacyLabel":{{json (index .Labels "com.healthloop.scope")}},"containers":{{json .Containers}}}', NETWORK_ID], env);
  const info = JSON.parse(raw);
  const attachedIds = validateNetworkMetadata(info);
  if (attachedIds.length) {
    const attached = await capture(docker, ['inspect', '--format', inspectFormat, ...attachedIds], env);
    // A matching network name/label does not authorize sharing with other projects.
    assertLoopbackContainers(attached.split(/\r?\n/).map((line) => JSON.parse(line)));
  }
}

function launch(cli, args, env, fd) {
  const child = spawn(cli, ['--workdir', root, '--network-id', NETWORK_ID, ...args], { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) {
    const filter = createCliLogFilter((line) => writeSync(fd, `${line}\n`));
    stream.setEncoding('utf8'); stream.on('data', (chunk) => filter.write(chunk)); stream.on('end', () => filter.end());
  }
  const done = new Promise((accept, reject) => {
    child.once('error', () => reject(new Error('Supabase CLI could not start.')));
    child.once('close', (code, signal) => accept(code ?? (signal === 'SIGINT' ? 130 : 1)));
  });
  return { child, done };
}

function signalGroup(child, signal) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch { /* The owned process group has already exited. */ }
}

async function terminate(command) {
  if (!command) return;
  signalGroup(command.child, 'SIGTERM');
  const timer = setTimeout(() => signalGroup(command.child, 'SIGKILL'), 2_000);
  try { await command.done; } finally { clearTimeout(timer); }
}

async function main() {
  const [action, suppliedEnv, ...rest] = process.argv.slice(2);
  if (!['start', 'serve', 'stop'].includes(action) || rest.length || (action !== 'serve' && suppliedEnv)) fail('Usage: node scripts/local-backend.mjs start|stop|serve [existing-core-env-file]');
  if (process.env.HEALTHLOOP_ALLOW_LOCAL_STACK !== 'local-only') fail('Set HEALTHLOOP_ALLOW_LOCAL_STACK=local-only to operate the isolated local stack.');
  await validateLocalConfig(await readFile(join(root, 'supabase/config.toml'), 'utf8'));
  const docker = await executable('docker');
  const cli = join(root, 'node_modules/.bin/supabase');
  await access(cli, constants.X_OK);
  // Read only the active Docker endpoint, never settings, keys, or a full inspect.
  const endpoint = process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT
    ? process.env.DOCKER_HOST
    : JSON.parse(await capture(docker, ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], process.env));
  if (typeof endpoint !== 'string' || !endpoint.startsWith('unix:///')) fail('Only a local Unix-socket Docker engine is allowed.');
  const env = { ...process.env, DOCKER_HOST: endpoint };
  delete env.DOCKER_CONTEXT;
  // Local commands do not need cloud credentials, linked project overrides, or port overrides.
  for (const name of Object.keys(env)) if (name.startsWith('SUPABASE_')) delete env[name];
  if (await capture(cli, ['--version'], env) !== supportedVersion) fail('This adapter is verified only for Supabase CLI 2.117.0.');
  const local = join(root, '.local');
  await mkdir(local, { recursive: true, mode: 0o700 });
  const logPath = join(local, `local-backend-${action}.log`);
  const log = await open(logPath, 'a', 0o600); await chmod(logPath, 0o600);
  const shim = await mkdtemp(join(local, 'docker-loopback-'));
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(join(shim, 'docker'), `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(join(root, 'scripts/docker-loopback.mjs'))} "$@"\n`, { mode: 0o700 });
  env.PATH = `${shim}${delimiter}${env.PATH ?? ''}`;
  env.HEALTHLOOP_REAL_DOCKER = docker;
  env.HEALTHLOOP_LOOPBACK_AUDIT = join(local, 'docker-loopback-audit.log');
  let active;
  let interrupted = false;
  const interrupt = () => { interrupted = true; signalGroup(active?.child, 'SIGINT'); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  async function stopOwned() {
    // Stop exact owned identities first, so a CLI error cannot leave an unsafe listener running.
    const { ids } = await ownedContainers(docker, env);
    if (ids.length) await capture(docker, ['stop', '--time', '10', ...ids], env, 45_000);
    const stopping = launch(cli, ['stop', '--project-id', PROJECT_ID], env, log.fd);
    const timer = setTimeout(() => signalGroup(stopping.child, 'SIGKILL'), 60_000);
    try {
      if (await stopping.done !== 0) fail('Supabase CLI stop did not complete successfully; inspect the filtered local log.');
    } finally { clearTimeout(timer); }
    const remaining = await ownedContainers(docker, env);
    if (remaining.containers.some((item) => item.running)) fail('Owned local containers could not be stopped.');
  }
  try {
    console.log(`Local ${action}: CLI output is kept in a private .local log; credentials are not printed.`);
    if (action === 'stop') { await stopOwned(); console.log('The HealthLoop local stack is stopped; volumes are preserved.'); return; }
    await network(docker, env, action === 'start');
    const existing = await ownedContainers(docker, env);
    assertLoopbackContainers(existing.containers, { requireAll: action === 'serve' });
    let args;
    if (action === 'serve') {
      const envPath = suppliedEnv ? (isAbsolute(suppliedEnv) ? suppliedEnv : resolve(root, suppliedEnv)) : join(root, 'supabase/functions/core/.env.local');
      const canonical = await realpath(envPath);
      if (!canonical.startsWith(`${root}/`)) fail('The core environment file must already exist inside this project.');
      validateServeEnv(await readFile(canonical, 'utf8'));
      args = ['functions', 'serve', 'core', '--env-file', canonical];
    } else args = ['start', '--exclude', excludes];
    active = launch(cli, args, env, log.fd);
    let finished = false;
    active.done.finally(() => { finished = true; }).catch(() => {});
    // Inspect while the CLI is bringing up/replacing containers too, not just after success.
    while (!finished) {
      await delay(1_000);
      assertLoopbackContainers((await ownedContainers(docker, env)).containers);
    }
    const code = await active.done;
    if (interrupted && action === 'serve') { process.exitCode = 130; return; }
    if (code !== 0) fail('Supabase CLI did not complete successfully; inspect the private local log.');
    assertLoopbackContainers((await ownedContainers(docker, env)).containers, { requireAll: true });
    console.log('Verified: API 54321, database 54322, and Mailpit 54324 publish only on 127.0.0.1.');
  } catch (error) {
    await terminate(active);
    try { await stopOwned(); } catch { fail('Local startup failed and automatic stop could not be verified. Inspect only this project’s containers.'); }
    throw error;
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt);
    await rm(shim, { recursive: true, force: true });
    await log.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Local backend operation failed.'); process.exitCode = 1; });
}
