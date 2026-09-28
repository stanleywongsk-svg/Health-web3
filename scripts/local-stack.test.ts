import { describe, expect, it } from 'vitest';
import { extractEmailOtp, localUrl, requireLocalApproval, syntheticEmail, validateLocalStatus } from './local-stack.ts';

const valid = { API_URL: 'http://127.0.0.1:54321', INBUCKET_URL: 'http://127.0.0.1:54324', DB_URL: 'postgresql://postgres:fixture-secret@127.0.0.1:54322/postgres', ANON_KEY: 'synthetic-anon-key-for-guard', SERVICE_ROLE_KEY: 'synthetic-service-key-for-guard' };
describe('local stack integration guards (no network)', () => {
  it('requires explicit local-only approval and the exact top-level project', () => {
    expect(() => requireLocalApproval('local-only', 'project_id = "healthloop-local-dev"\n[auth]\nenabled=true')).not.toThrow();
    for (const allow of [undefined, '', 'true', 'production']) expect(() => requireLocalApproval(allow, 'project_id="healthloop-local-dev"')).toThrow();
    for (const config of ['project_id="other-project"', '[auth]\nproject_id="healthloop-local-dev"', 'project_id="healthloop-local-dev"\nproject_id="other-project"', 'project_id="healthloop-local-dev"\nproject_id=\'other-project\'']) expect(() => requireLocalApproval('local-only', config)).toThrow();
  });
  it('accepts only explicit loopback origins and the local postgres database', () => {
    expect(validateLocalStatus(valid).apiUrl).toBe('http://127.0.0.1:54321');
    expect(validateLocalStatus({ ...valid, INBUCKET_URL: undefined, MAILPIT_URL: 'http://localhost:54324' }).mailUrl).toBe('http://localhost:54324');
    for (const bad of ['https://remote.supabase.co:443', 'http://127.0.0.1.evil.test:54321', 'http://127.1:54321', 'http://2130706433:54321', 'http://user:secret@localhost:54321', 'http://localhost:54321/path', 'http://localhost:54321?x=y', 'http://localhost:54321#secret', 'http://localhost:54321\\@evil.test']) expect(() => localUrl(bad, 'http')).toThrow();
    for (const bad of ['postgresql://postgres:secret@remote.test:54322/postgres', 'postgresql://postgres:secret@127.0.0.1:54322/production', 'postgresql://postgres:secret@127.0.0.1:54322/postgres?host=evil.test']) expect(() => localUrl(bad, 'database')).toThrow();
  });
  it('fails closed on missing keys and never includes a secret URL in diagnostics', () => {
    expect(() => validateLocalStatus({ ...valid, SERVICE_ROLE_KEY: undefined })).toThrow();
    const sentinel = 'unique-sensitive-sentinel';
    try { localUrl(`http://${sentinel}@remote.test:54321`, 'http'); throw new Error('guard did not reject'); }
    catch (error) { expect(String(error)).not.toContain(sentinel); expect(String(error)).toContain('guard rejected'); }
  });
  it('generates only labeled unique local.invalid recipients', () => {
    expect(syntheticEmail('a'.repeat(32), 'subject')).toMatch(/^hl-[a-f0-9]{32}-subject@local\.invalid$/);
    expect(() => syntheticEmail('a'.repeat(32), 'human@example.com')).toThrow();
    expect(() => syntheticEmail('../not-a-run', 'subject')).toThrow();
  });
  it('reads only the exact synthetic recipient and rejects ambiguous codes without exposing mail', () => {
    const email = syntheticEmail('a'.repeat(32), 'subject');
    const message = { To: [{ Address: email }], Text: 'Code 123456', HTML: '<p>123456</p>' };
    expect(extractEmailOtp(message, email)).toBe('123456');
    expect(() => extractEmailOtp({ ...message, To: [{ Address: 'unrelated@local.invalid' }] }, email)).toThrow();
    expect(() => extractEmailOtp({ ...message, Text: '123456 654321' }, email)).toThrow();
    expect(() => extractEmailOtp(message, 'person@example.com')).toThrow();
  });
});
