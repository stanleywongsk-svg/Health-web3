#!/usr/bin/env node
/** Project-only Docker CLI adapter. Never install this in a global PATH. */
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const PROJECT_ID = 'healthloop-local-dev';
export const NETWORK_ID = 'healthloop-local-network';
export const PUBLISHED_PORTS = Object.freeze({ '54321': '8000', '54322': '5432', '54324': '8025' });
const ownedName = /^supabase_[a-z0-9_]+_healthloop-local-dev$/;
const globalValues = new Set(['--config', '--context', '-c', '--host', '-H', '--log-level', '-l', '--tlscacert', '--tlscert', '--tlskey']);
const globalBooleans = new Set(['--debug', '-D', '--tls', '--tlsverify', '--help', '-h', '--version', '-v']);
const createValues = new Set([
  '--name', '--network', '--net', '--publish', '-p', '--hostname', '-h', '--env', '-e', '--env-file',
  '--label', '-l', '--label-file', '--entrypoint', '--user', '-u', '--workdir', '-w', '--volume', '-v',
  '--mount', '--volumes-from', '--network-alias', '--add-host', '--expose', '--health-cmd', '--health-interval', '--health-timeout',
  '--health-start-period', '--health-start-interval', '--health-retries', '--restart', '--log-driver',
  '--log-opt', '--cap-add', '--cap-drop', '--security-opt', '--ulimit', '--shm-size', '--memory', '-m',
  '--memory-swap', '--cpus', '--cpu-shares', '-c', '--tmpfs', '--device', '--dns', '--dns-search',
  '--dns-option', '--ipc', '--pid', '--platform', '--pull', '--stop-signal', '--stop-timeout', '--cidfile',
]);
const createBooleans = new Set(['--rm', '--init', '--read-only', '--interactive', '-i', '--tty', '-t', '--detach', '-d', '--no-healthcheck', '--sig-proxy']);
function reject() { throw new Error('Docker loopback policy rejected this operation. No command arguments are logged.'); }
function option(token) {
  const at = token.indexOf('=');
  return at < 0 ? [token, undefined] : [token.slice(0, at), token.slice(at + 1)];
}
function portBinding(value) {
  // Fixed TCP mappings only: no random ports, ranges, UDP, or IPv6 wildcard.
  const match = /^(?:(127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\[::\]|[^:]+)?:)?(\d+):(\d+)(\/tcp)?$/.exec(value);
  if (!match) return reject();
  const [, address, host, container, protocol = ''] = match;
  if (address && address !== '127.0.0.1' && address !== '[::1]') return reject();
  if (PUBLISHED_PORTS[host] !== container) return reject();
  // Normalize IPv6 loopback too, keeping one predictable host address.
  return `127.0.0.1:${host}:${container}${protocol}`;
}

/** Pure argv transform; image command arguments and environment values stay opaque. */
export function rewriteDockerArgs(argv) {
  const result = [...argv];
  let position = 0;
  let targetOverride = false;
  for (; position < result.length && result[position].startsWith('-'); position++) {
    const [key, value] = option(result[position]);
    if (globalValues.has(key)) {
      if (['--host', '-H', '--context', '-c'].includes(key)) targetOverride = true;
      if (value === undefined && ++position >= result.length) return reject();
    } else if (!globalBooleans.has(key)) return reject();
  }
  let verb = result[position++];
  if (verb === 'container') verb = result[position++];
  if (verb !== 'create' && verb !== 'run') return result;
  if (targetOverride) return reject(); // the launcher pins the local Unix endpoint.
  let name;
  let network;
  let projectLabel;
  const publications = [];
  for (; position < result.length; position++) {
    const token = result[position];
    if (token === '--' || !token.startsWith('-')) break; // image begins; never inspect its command.
    let [key, value] = option(token);
    const inline = value !== undefined;
    if (key === '--publish-all' || key === '-P' || key === '--privileged') return reject();
    if (createBooleans.has(key)) continue;
    if (!createValues.has(key)) return reject();
    if (value === undefined) {
      value = result[++position];
      if (value === undefined) return reject();
    }
    if (key === '--name') {
      if (name !== undefined) return reject();
      name = value;
    }
    if (key === '--network' || key === '--net') {
      if (network !== undefined) return reject();
      network = value;
    }
    if ((key === '--label' || key === '-l') && value.startsWith('com.supabase.cli.project=')) {
      if (projectLabel !== undefined) return reject();
      projectLabel = value.slice('com.supabase.cli.project='.length);
    }
    if (key === '--publish' || key === '-p') publications.push({ index: position, key, inline, value });
  }
  if (network === 'host' || network?.startsWith('container:')) return reject();
  if (ownedName.test(name ?? '') && network !== NETWORK_ID) return reject();
  if (!publications.length) return result; // one-shot migration containers publish nothing.
  if (!ownedName.test(name ?? '') || network !== NETWORK_ID || projectLabel !== PROJECT_ID) return reject();
  const seen = new Set();
  for (const item of publications) {
    const binding = portBinding(item.value);
    if (seen.has(binding.replace(/\/tcp$/, ''))) return reject();
    seen.add(binding.replace(/\/tcp$/, ''));
    result[item.index] = item.inline ? `${item.key}=${binding}` : binding;
  }
  return result;
}

/** Inspect only these selected fields, never Docker Config.Env or complete inspect output. */
export function assertLoopbackContainers(containers, { requireAll = false } = {}) {
  const published = new Set();
  for (const container of containers) {
    if (!ownedName.test(container.name?.replace(/^\//, '') ?? '') || container.projectLabel !== PROJECT_ID) return reject();
    const networkNames = Object.keys(container.networks ?? {});
    if (networkNames.length !== 1 || networkNames[0] !== NETWORK_ID) return reject();
    if (requireAll && container.health && container.health !== 'healthy') return reject();
    for (const [kind, ports] of [['configured', container.bindings], ['actual', container.ports]]) {
      for (const [target, bindings] of Object.entries(ports ?? {})) {
        if (bindings === null) continue; // exposed to Docker network, not published.
        if (!Array.isArray(bindings)) return reject();
        for (const binding of bindings) {
          if (binding.HostIp !== '127.0.0.1' || !Object.hasOwn(PUBLISHED_PORTS, binding.HostPort) || PUBLISHED_PORTS[binding.HostPort] + '/tcp' !== target) return reject();
          if (kind === 'actual' && container.running) published.add(binding.HostPort);
        }
      }
    }
  }
  if (requireAll && Object.keys(PUBLISHED_PORTS).some((port) => !published.has(port))) return reject();
}

async function main() {
  const realDocker = process.env.HEALTHLOOP_REAL_DOCKER;
  if (process.env.HEALTHLOOP_ALLOW_LOCAL_STACK !== 'local-only' || !realDocker?.startsWith('/') || realDocker === fileURLToPath(import.meta.url)) return reject();
  const original = process.argv.slice(2);
  const args = rewriteDockerArgs(original);
  if (args.some((arg, index) => arg !== original[index]) && process.env.HEALTHLOOP_LOOPBACK_AUDIT) {
    // No env values or credentials. This proves the wrapper intercepted publication.
    appendFileSync(process.env.HEALTHLOOP_LOOPBACK_AUDIT, 'Rewrote owned Docker publication to 127.0.0.1\n', { mode: 0o600 });
  }
  const child = spawn(realDocker, args, { stdio: 'inherit', env: process.env });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  const code = await new Promise((accept, fail) => {
    child.once('error', fail);
    child.once('exit', (status, signal) => accept(status ?? (signal === 'SIGINT' ? 130 : 1)));
  });
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
  process.exitCode = code;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Docker loopback policy failed. No command arguments are logged.'); process.exitCode = 1; });
}
