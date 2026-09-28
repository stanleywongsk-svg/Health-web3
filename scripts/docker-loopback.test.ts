import { describe, expect, it } from 'vitest';
// @ts-expect-error Standalone Node adapter is intentionally JavaScript, outside the TS production graph.
import { rewriteDockerArgs, assertLoopbackContainers, PROJECT_ID, NETWORK_ID } from './docker-loopback.mjs';
// @ts-expect-error Standalone Node launcher is intentionally JavaScript, outside the TS production graph.
import { validateLocalConfig, validateServeEnv, validateNetworkMetadata, filterCliLine, createCliLogFilter } from './local-backend.mjs';

const name = `supabase_kong_${PROJECT_ID}`;
const ownership = ['--name', name, '--network', NETWORK_ID, '--label', `com.supabase.cli.project=${PROJECT_ID}`];
const create = (...args: string[]) => ['create', ...ownership, ...args, 'supabase/kong:2.8.1'];
const row = (host: string, target: string, health: string | null = 'healthy') => ({
  name: `/supabase_service_${host}_${PROJECT_ID}`, projectLabel: PROJECT_ID, networks: { [NETWORK_ID]: {} },
  bindings: { [`${target}/tcp`]: [{ HostIp: '127.0.0.1', HostPort: host }] },
  ports: { [`${target}/tcp`]: [{ HostIp: '127.0.0.1', HostPort: host }] }, running: true, health,
});
const all = () => [row('54321', '8000'), row('54322', '5432'), row('54324', '8025')];

describe('project-scoped Docker publication adapter', () => {
  it.each(['-p', '--publish'])('rewrites separate %s without modifying caller args', (flag) => {
    const args = create(flag, '54321:8000');
    expect(rewriteDockerArgs(args)).toEqual(create(flag, '127.0.0.1:54321:8000'));
    expect(args).toContain('54321:8000');
  });
  it('supports equals-form ownership/publication and container subcommand', () => {
    const args = ['container', 'create', `--name=${name}`, `--network=${NETWORK_ID}`, `--label=com.supabase.cli.project=${PROJECT_ID}`, '--publish=54321:8000', 'image'];
    expect(rewriteDockerArgs(args)).toContain('--publish=127.0.0.1:54321:8000');
  });
  it.each([':54321:8000', '127.0.0.1:54321:8000', '[::1]:54321:8000'])('normalizes loopback/empty binding %s', (binding) => {
    expect(rewriteDockerArgs(create('-p', binding))).toContain('127.0.0.1:54321:8000');
  });
  it('permits only the three exact fixed TCP port mappings', () => {
    expect(rewriteDockerArgs(create('-p', '54322:5432/tcp', '-p', '54324:8025'))).toEqual(create('-p', '127.0.0.1:54322:5432/tcp', '-p', '127.0.0.1:54324:8025'));
  });
  it.each(['0.0.0.0:54321:8000', '[::]:54321:8000', '192.168.1.20:54321:8000', 'localhost:54321:8000', '54321:8000/udp', '54321-54322:8000', '54321:9999', '54323:3000', '8000', '0:8000'])('rejects unsafe/unknown mapping %s', (binding) => {
    expect(() => rewriteDockerArgs(create('-p', binding))).toThrow('loopback policy');
  });
  it.each(['-P', '--publish-all', '--publish-all=true', '--privileged'])('rejects implicit publication/privileged flag %s', (flag) => {
    expect(() => rewriteDockerArgs(create(flag))).toThrow();
  });
  it('rejects duplicate publication, repeated identity and unknown create options', () => {
    expect(() => rewriteDockerArgs(create('-p', '54321:8000', '--publish', '54321:8000/tcp'))).toThrow();
    expect(() => rewriteDockerArgs(create('--name', name, '-p', '54321:8000'))).toThrow();
    expect(() => rewriteDockerArgs(create('--unknown-option', 'value'))).toThrow();
  });
  it('rejects lookalike project names, missing label and wrong network before publishing', () => {
    for (const bad of [
      ['create', '--name', `${name}-other`, '--network', NETWORK_ID, '-p', '54321:8000', 'image'],
      ['create', '--name', name, '--network', NETWORK_ID, '-p', '54321:8000', 'image'],
      ['create', '--name', name, '--network', 'other', '--label', `com.supabase.cli.project=${PROJECT_ID}`, '-p', '54321:8000', 'image'],
    ]) expect(() => rewriteDockerArgs(bad)).toThrow();
  });
  it.each(['host', 'container:another'])('rejects bypass network %s even without publications', (network) => {
    expect(() => rewriteDockerArgs(['run', '--name', name, '--network', network, 'image'])).toThrow();
    expect(() => rewriteDockerArgs(['run', '--network', network, 'image'])).toThrow();
  });
  it('permits unpublished migration commands on the project network', () => {
    const args = ['run', '--rm', '--network', NETWORK_ID, '--entrypoint', '/bin/sh', 'image', '-c', 'migration'];
    expect(rewriteDockerArgs(args)).toEqual(args);
  });
  it('does not parse environment, mount or image command arguments as Docker flags', () => {
    const args = [...create('-e', '-p', '-v', '/host/path:/container/path', '--network-alias', 'api.supabase.internal'), '-p', '9000:9000', '--network', 'host'];
    expect(rewriteDockerArgs(args)).toEqual(args);
  });
  it('passes global options for read-only commands but rejects target overrides for create/run', () => {
    const args = ['--context', 'desktop-linux', 'inspect', '--format={{.Name}}', name];
    expect(rewriteDockerArgs(args)).toEqual(args);
    expect(() => rewriteDockerArgs(['--host=tcp://remote:2375', ...create('-p', '54321:8000')])).toThrow();
    expect(() => rewriteDockerArgs(['--context', 'remote', ...create('-p', '54321:8000')])).toThrow();
  });
  it('never includes credentials or complete arguments in policy errors', () => {
    expect(() => rewriteDockerArgs(create('-e', 'PRIVATE_KEY=DO_NOT_LOG_ME', '-p', '9000:9000'))).toThrow(/^Docker loopback policy rejected this operation\. No command arguments are logged\.$/);
  });
});

describe('actual selected Docker inspect verification', () => {
  it('requires configured and running ports on IPv4 loopback', () => {
    expect(() => assertLoopbackContainers(all(), { requireAll: true })).not.toThrow();
    for (const section of ['bindings', 'ports'] as const) {
      const rows = all();
      rows[0]![section]['8000/tcp']![0]!.HostIp = '0.0.0.0';
      expect(() => assertLoopbackContainers(rows, { requireAll: true })).toThrow();
    }
  });
  it('rejects empty configured host IP even if Docker currently reports loopback', () => {
    const rows = all(); rows[0]!.bindings['8000/tcp']![0]!.HostIp = '';
    expect(() => assertLoopbackContainers(rows)).toThrow();
  });
  it('rejects missing required port, wrong label, additional network and unhealthy state', () => {
    expect(() => assertLoopbackContainers(all().slice(1), { requireAll: true })).toThrow();
    expect(() => assertLoopbackContainers([{ ...row('54321', '8000'), projectLabel: 'another-project' }])).toThrow();
    expect(() => assertLoopbackContainers([{ ...row('54321', '8000'), networks: { [NETWORK_ID]: {}, bridge: {} } }])).toThrow();
    expect(() => assertLoopbackContainers([...all(), row('54321', '8000', 'unhealthy')], { requireAll: true })).toThrow();
  });
  it('allows startup health transitions until the final health assertion', () => {
    expect(() => assertLoopbackContainers([row('54321', '8000', 'starting')])).not.toThrow();
    expect(() => assertLoopbackContainers([row('54321', '8000', null)])).not.toThrow();
  });
  it('accepts exposed, unpublished internal ports', () => {
    const internal = { name: `/supabase_auth_${PROJECT_ID}`, projectLabel: PROJECT_ID, networks: { [NETWORK_ID]: {} }, bindings: {}, ports: { '9999/tcp': null }, running: true, health: 'healthy' };
    expect(() => assertLoopbackContainers([...all(), internal], { requireAll: true })).not.toThrow();
  });
});

describe('launcher fixed local-only config', () => {
  const config = `project_id = "${PROJECT_ID}"\n[api]\nport=54321\n[db]\nport=54322\n[local_smtp]\nenabled=true\nport=54324\n`;
  const env = `HEALTHLOOP_ENV=test\nHEALTHLOOP_BUILD_MODE=real\nHEALTHLOOP_PROJECT_LABEL=${PROJECT_ID}\nHEALTHLOOP_ALLOWED_ORIGINS=http://localhost:8081\n`;
  it('accepts the exact local project and both CLI-compatible mail section names', () => {
    expect(() => validateLocalConfig(config)).not.toThrow();
    expect(() => validateLocalConfig(config.replace('local_smtp', 'inbucket'))).not.toThrow();
  });
  it('rejects another project, alternate ports and TLS mode', () => {
    expect(() => validateLocalConfig(config.replace(PROJECT_ID, 'another'))).toThrow();
    expect(() => validateLocalConfig(config.replace('54322', '64322'))).toThrow();
    expect(() => validateLocalConfig(`${config}[api.tls]\nenabled=true\n`)).toThrow();
  });
  it('accepts test/real env and refuses production, demo, remote origins or injected credentials', () => {
    expect(() => validateServeEnv(env)).not.toThrow();
    expect(() => validateServeEnv(env.replace('ENV=test', 'ENV=production'))).toThrow();
    expect(() => validateServeEnv(env.replace('MODE=real', 'MODE=demo'))).toThrow();
    expect(() => validateServeEnv(env.replace('http://localhost:8081', 'https://example.com'))).toThrow();
    expect(() => validateServeEnv(`${env}SUPABASE_SERVICE_ROLE_KEY=DO_NOT_LOG_ME\n`)).toThrow('credentials are injected');
  });
  it('requires the new project network label or the exact operator-created legacy label', () => {
    const network = { name: NETWORK_ID, driver: 'bridge', options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' }, projectLabel: PROJECT_ID, containers: {} };
    expect(validateNetworkMetadata(network)).toEqual([]);
    expect(validateNetworkMetadata({ ...network, projectLabel: '', legacyLabel: 'local-synthetic' })).toEqual([]);
    expect(() => validateNetworkMetadata({ ...network, projectLabel: '' })).toThrow();
    expect(() => validateNetworkMetadata({ ...network, projectLabel: '', legacyLabel: 'other-project' })).toThrow();
  });
  it('returns exact attached identities for additional ownership inspection', () => {
    const id = 'a'.repeat(64);
    const network = { name: NETWORK_ID, driver: 'bridge', options: { 'com.docker.network.bridge.host_binding_ipv4': '127.0.0.1' }, projectLabel: PROJECT_ID, containers: { [id]: {} } };
    expect(validateNetworkMetadata(network)).toEqual([id]);
    expect(() => validateNetworkMetadata({ ...network, containers: { 'not-an-id': {} } })).toThrow();
  });
});

describe('private CLI logs redact credentials before writing', () => {
  it.each(['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZW1vIn0.signature', 'sb_secret_synthetic_fixture', 'sb_publishable_synthetic_fixture', 'Database URL: postgresql://user:fixture@localhost/db', 'Secret key: fixture', 'Password: fixture', 'Refresh token: fixture'])('omits credential-bearing lines without echoing their contents', (line) => {
    expect(filterCliLine(line)).toBe('[credential-bearing line omitted]');
  });
  it('retains non-sensitive startup errors and buffers split credentials', () => {
    const lines: string[] = [];
    const filter = createCliLogFilter((line: string) => lines.push(line));
    filter.write('Starting database...\nfailed health check\nBearer ey');
    filter.write('JhbGciOiJIUzI1NiJ9.payload.signature');
    expect(lines).toEqual(['Starting database...', 'failed health check']);
    filter.write('\nReady\n'); filter.end();
    expect(lines).toEqual(['Starting database...', 'failed health check', '[credential-bearing line omitted]', 'Ready']);
  });
  it('bounds oversized lines and resumes at the next complete line', () => {
    const lines: string[] = [];
    const filter = createCliLogFilter((line: string) => lines.push(line));
    filter.write('x'.repeat(9_000)); filter.write('secret-rest\nReady'); filter.end();
    expect(lines).toEqual(['[oversized CLI line omitted]', 'Ready']);
  });
});
