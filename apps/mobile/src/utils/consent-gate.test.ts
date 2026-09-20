import { describe, expect, it } from 'vitest';
import { ConsentGate } from './consent-gate';
describe('consent cancellation', () => {
  it('aborts queued sync and rejects late completion after withdrawal', () => { const g = new ConsentGate(); g.configure('a', true, true); const pending = g.begin(true); g.configure('a', true, false); expect(pending.signal.aborted).toBe(true); expect(pending.isCurrent()).toBe(false); expect(() => g.begin(true)).toThrow('CONSENT_REQUIRED'); expect(g.begin().isCurrent()).toBe(true); });
  it('does not let prior account data cross an account switch', () => { const g = new ConsentGate(); g.configure('a',true,true); const a = g.begin(); g.configure('b',true,true); expect(a.isCurrent()).toBe(false); expect(g.begin().isCurrent()).toBe(true); });
  it('revokes local reads independently of cloud setting', () => { const g = new ConsentGate(); g.configure('a',true,true); const pending = g.begin(); g.configure('a',false,false); expect(pending.signal.aborted).toBe(true); expect(() => g.begin()).toThrow(); });
});
