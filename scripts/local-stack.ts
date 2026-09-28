/** Local integration safety boundaries. Errors deliberately omit untrusted values. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LOCAL_PROJECT = 'healthloop-local-dev';
export const FIXTURE_LABEL = 'healthloop-local-http-synthetic';
export interface LocalStack {
  apiUrl: string; mailUrl: string; databaseUrl: string; anonKey: string; serviceKey: string;
}
function fail(): never { throw new Error('Local stack guard rejected configuration; no endpoint or credential is logged.'); }
export function requireLocalApproval(allow: string | undefined, config: string): void {
  const top = config.split(/^\s*\[/m)[0] ?? '';
  const projects = [...top.matchAll(/^\s*project_id\s*=\s*"([^"]+)"\s*(?:#.*)?$/gm)];
  const assignments = [...top.matchAll(/^\s*project_id\s*=/gm)];
  if (allow !== 'local-only' || assignments.length !== 1 || projects.length !== 1 || projects[0]?.[1] !== LOCAL_PROJECT) fail();
}
export function localUrl(value: unknown, kind: 'http' | 'database'): string {
  if (typeof value !== 'string' || /[\s\\]/.test(value)) fail();
  let url: URL;
  try { url = new URL(value); } catch { return fail(); }
  const authority = value.split('://')[1]?.split('/')[0]?.split('@').at(-1);
  // Require explicit canonical loopback spelling, not DNS suffixes or numeric aliases.
  if (!authority || !/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(authority)
    || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.port || url.search || url.hash) fail();
  if (kind === 'http') {
    if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/') fail();
    return url.origin;
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/postgres') fail();
  return value;
}
export function validateLocalStatus(input: unknown): LocalStack {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail();
  const data = input as Record<string, unknown>;
  if (typeof data.ANON_KEY !== 'string' || data.ANON_KEY.length < 20
    || typeof data.SERVICE_ROLE_KEY !== 'string' || data.SERVICE_ROLE_KEY.length < 20) fail();
  return {
    apiUrl: localUrl(data.API_URL, 'http'), mailUrl: localUrl(data.MAILPIT_URL ?? data.INBUCKET_URL, 'http'),
    databaseUrl: localUrl(data.DB_URL, 'database'), anonKey: data.ANON_KEY, serviceKey: data.SERVICE_ROLE_KEY,
  };
}
export function loadLocalStack(directory: string, allow: string | undefined): LocalStack {
  let config: string;
  try { config = readFileSync(resolve(directory, 'supabase/config.toml'), 'utf8'); } catch { return fail(); }
  requireLocalApproval(allow, config);
  try {
    // stdout contains secrets. Never inherit stdio, print the result or attach a cause.
    const status = execFileSync('pnpm', ['exec', 'supabase', '--workdir', directory, 'status', '-o', 'json'], {
      cwd: directory, encoding: 'utf8', timeout: 20_000, maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
    return validateLocalStatus(JSON.parse(status));
  } catch { throw new Error('Local Supabase status unavailable or unsafe; start the approved stack first.'); }
}
export function syntheticEmail(runId: string, suffix: string): string {
  if (!/^[a-f0-9]{32}$/.test(runId) || !/^[a-z]{1,12}$/.test(suffix)) fail();
  return `hl-${runId}-${suffix}@local.invalid`;
}
export function extractEmailOtp(message: unknown, email: string): string {
  if (!/^hl-[a-f0-9]{32}-[a-z]{1,12}@local\.invalid$/.test(email) || !message || typeof message !== 'object') fail();
  const body = message as Record<string, unknown>;
  const recipients = body.To;
  if (!Array.isArray(recipients) || !recipients.some(recipient => recipient?.Address === email)) fail();
  const text = `${typeof body.Text === 'string' ? body.Text : ''} ${typeof body.HTML === 'string' ? body.HTML.replace(/<[^>]+>/g, ' ') : ''}`;
  const candidates = new Set(text.match(/\b[0-9]{6}\b/g));
  if (candidates.size !== 1) throw new Error('Local OTP email has no unambiguous code; message content withheld.');
  return [...candidates][0]!;
}
