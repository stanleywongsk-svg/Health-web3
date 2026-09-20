import { describe, expect, it, vi } from 'vitest';
import type { ConsentState, CoreClient } from '@healthloop/api-client';
import { ConsentController, confirmedConsentKey, withdrawalKey } from './consent-controller';
const profile = (id = 'a') => ({ id, status: 'active', adultConfirmed: true, localRead: true, cloudSync: true, marketing: false, consentVersion: '2026-09-18' });
const failure = (code: string, status = 0) => Object.assign(new Error(code), { code, status });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function setup() {
  const data = new Map<string,string>();
  const storage = { getItem: async (key:string) => data.get(key) ?? null, setItem: async (key:string,value:string) => { data.set(key,value); }, removeItem: async (key:string) => { data.delete(key); } };
  const api = { getConsents: vi.fn<CoreClient['getConsents']>().mockResolvedValue({profile:profile()}), setConsents: vi.fn<CoreClient['setConsents']>().mockImplementation(async input=>({profile:{...profile(),localRead:input.localRead,cloudSync:input.cloudSync,marketing:input.marketing}})) };
  const make = () => new ConsentController({ api, storage, now: () => new Date('2026-09-20T01:00:00Z') });
  return { data, storage, api, make };
}
describe('live mobile consent controller', () => {
  it.each(['NETWORK_ERROR','TIMEOUT'])('restores only previously server-confirmed local access on %s', async code => {
    const { api,make,data } = setup(); const original=make(); await original.start('a');
    expect(data.has(confirmedConsentKey('a'))).toBe(true);
    api.getConsents.mockRejectedValue(failure(code)); const restarted=make(); await restarted.start('a');
    expect(restarted.getSnapshot()).toMatchObject({connection:'offline',onboarded:true,localAllowed:true,cloudAllowed:false});
  });
  it('cannot grant access from an old draft or unsaved opt-in', async()=>{
    const {api,make,data}=setup(); data.set('consent.a',JSON.stringify({adultConfirmed:true,localRead:true,cloudSync:true,marketing:false}));
    api.getConsents.mockRejectedValue(failure('NETWORK_ERROR')); const first=make(); await first.start('a');
    expect(first.getSnapshot()).toMatchObject({onboarded:false,localAllowed:false,cloudAllowed:false});
    await first.change('localRead',true); expect(first.getSnapshot().localAllowed).toBe(false);
    const restarted=make(); await restarted.start('a'); expect(restarted.getSnapshot().localAllowed).toBe(false);
  });
  it('does not promote a failed save into confirmed adult/local-read consent',async()=>{
    const {api,make,data}=setup(); api.getConsents.mockResolvedValue({profile:null}); const c=make(); await c.start('a');
    await c.change('localRead',true); api.setConsents.mockRejectedValue(failure('NETWORK_ERROR'));
    await expect(c.save(true)).rejects.toMatchObject({code:'NETWORK_ERROR'}); expect(data.has(confirmedConsentKey('a'))).toBe(false);
    expect(c.getSnapshot()).toMatchObject({connection:'offline',onboarded:false,localAllowed:false});
  });
  it('ignores cached records with another account, version or missing server provenance',async()=>{
    const {api,make,data}=setup(); api.getConsents.mockRejectedValue(failure('NETWORK_ERROR'));
    for(const record of [{schema:1,accountId:'b',confirmedAt:'2026-09-20T01:00:00Z',profile:profile('b')},{schema:1,accountId:'a',confirmedAt:'2026-09-20T01:00:00Z',profile:{...profile(),consentVersion:'old'}},{...profile()}]){
      data.set(confirmedConsentKey('a'),JSON.stringify(record));const c=make();await c.start('a');expect(c.getSnapshot().localAllowed).toBe(false);
    }
  });
  it.each(['UNAUTHENTICATED','SESSION_UNAVAILABLE','FORBIDDEN','ACCOUNT_INACTIVE','ACCOUNT_DELETED','INVALID_RESPONSE'])('fails closed on %s and invalidates later offline fallback',async code=>{
    const {api,make,data}=setup();const original=make();await original.start('a');api.getConsents.mockRejectedValue(failure(code));
    const c=make();await c.start('a');expect(c.getSnapshot()).toMatchObject({connection:'blocked',localAllowed:false,cloudAllowed:false});expect(data.has(confirmedConsentKey('a'))).toBe(false);
    api.getConsents.mockRejectedValue(failure('NETWORK_ERROR'));const next=make();await next.start('a');expect(next.getSnapshot().localAllowed).toBe(false);
  });
  it('preserves withdrawal across a stale server save and a later offline restart',async()=>{
    const {api,make,data}=setup();const c=make();await c.start('a');const response=deferred<ConsentState>();api.setConsents.mockReturnValue(response.promise);
    const saving=c.save(true);await c.change('localRead',false);expect(c.getSnapshot().localAllowed).toBe(false);
    response.resolve({profile:profile()});expect(await saving).toBe(false);expect(c.getSnapshot().localAllowed).toBe(false);expect(JSON.parse(data.get(withdrawalKey('a'))!).localRead).toBe(true);
    api.getConsents.mockRejectedValue(failure('NETWORK_ERROR'));const restarted=make();await restarted.start('a');expect(restarted.getSnapshot().localAllowed).toBe(false);
  });
  it('requires successful explicit save to re-enable a withdrawn permission',async()=>{
    const {make}=setup();const c=make();await c.start('a');await c.change('cloudSync',false);await c.change('cloudSync',true);
    expect(c.getSnapshot().draft.cloudSync).toBe(true);expect(c.getSnapshot().cloudAllowed).toBe(false);
    await c.save(true);expect(c.getSnapshot().cloudAllowed).toBe(true);
  });
  it('keeps local withdrawal authoritative even when reconnect returns stale cloud true',async()=>{
    const {make}=setup();const c=make();await c.start('a');await c.change('cloudSync',false);await c.reconnect();
    expect(c.getSnapshot()).toMatchObject({connection:'online',localAllowed:true,cloudAllowed:false});
  });
  it('suspends cloud actions throughout reconnect and resumes only after a current response',async()=>{
    const {api,make}=setup();const c=make();await c.start('a');const response=deferred<ConsentState>();api.getConsents.mockReturnValue(response.promise);
    const reconnect=c.reconnect();expect(c.getSnapshot()).toMatchObject({connection:'verifying',cloudAllowed:false});response.resolve({profile:profile()});await reconnect;expect(c.getSnapshot().cloudAllowed).toBe(true);
  });
  it('aborts and rejects late account-A completions after switching to B',async()=>{
    const {api,make}=setup();const c=make();await c.start('a');const response=deferred<ConsentState>();api.getConsents.mockReturnValueOnce(response.promise);
    const reconnect=c.reconnect();const signal=api.getConsents.mock.calls.at(-1)![0];c.setAccount('b');expect(signal?.aborted).toBe(true);
    response.resolve({profile:profile()});await reconnect;expect(c.getSnapshot()).toMatchObject({accountId:'b',onboarded:false,localAllowed:false,cloudAllowed:false});
  });
  it('emits immediate logout/revocation so the live hook can cancel native work',async()=>{
    const {make}=setup();const c=make();await c.start('a');const seen:boolean[]=[];c.subscribe(()=>seen.push(c.getSnapshot().localAllowed));
    const withdrawal=c.change('localRead',false);expect(seen.at(-1)).toBe(false);await withdrawal;c.setAccount(null);expect(c.getSnapshot()).toMatchObject({connection:'signed_out',onboarded:false,localAllowed:false,cloudAllowed:false});
  });
  it('rejects inactive profiles and never reuses stale cached access',async()=>{
    const {api,make}=setup();const c=make();await c.start('a');api.getConsents.mockResolvedValue({profile:{...profile(),status:'deletion_requested'}});await c.reconnect();expect(c.getSnapshot().connection).toBe('blocked');expect(c.getSnapshot().localAllowed).toBe(false);
  });
});

it('fails closed for a corrupt withdrawal record instead of restoring cached true',async()=>{const {api,make,data}=setup();await make().start('a');data.set(withdrawalKey('a'),JSON.stringify({localRead:'false'}));api.getConsents.mockRejectedValue(failure('NETWORK_ERROR'));const c=make();await c.start('a');expect(c.getSnapshot()).toMatchObject({connection:'blocked',localAllowed:false,cloudAllowed:false})});
it('late rejected account-A reconnect cleanup cannot block account B',async()=>{
  const {api,storage,make}=setup();const originalRemove=storage.removeItem;
  const removal=deferred<void>();let removing=false;
  storage.removeItem=async key=>{if(key===confirmedConsentKey('a')){removing=true;await removal.promise}await originalRemove(key)};
  const c=make();await c.start('a');api.getConsents.mockRejectedValueOnce(failure('UNAUTHENTICATED',401));
  const oldReconnect=c.reconnect();while(!removing)await Promise.resolve();
  const responseB=deferred<ConsentState>();api.getConsents.mockReturnValueOnce(responseB.promise);const newStart=c.start('b');
  while(api.getConsents.mock.calls.length<3)await Promise.resolve();
  removal.resolve();await oldReconnect;expect(c.getSnapshot()).toMatchObject({accountId:'b',connection:'verifying'});
  responseB.resolve({profile:profile('b')});await newStart;expect(c.getSnapshot()).toMatchObject({accountId:'b',connection:'online',cloudAllowed:true});
});
it('withdrawal during confirmation persistence prevents a late save from clearing its overlay',async()=>{
  const {storage,make,api,data}=setup();const c=make();await c.start('a');const originalSet=storage.setItem;const writing=deferred<void>();let entered=false;
  storage.setItem=async(key,value)=>{if(key===confirmedConsentKey('a')){entered=true;await writing.promise}await originalSet(key,value)};
  const save=c.save(true);while(!entered)await Promise.resolve();await c.change('cloudSync',false);writing.resolve();expect(await save).toBe(false);
  expect(c.getSnapshot().cloudAllowed).toBe(false);expect(JSON.parse(data.get(withdrawalKey('a'))!).cloudSync).toBe(true);
  api.getConsents.mockRejectedValue(failure('TIMEOUT'));const restarted=make();await restarted.start('a');expect(restarted.getSnapshot()).toMatchObject({connection:'offline',localAllowed:true,cloudAllowed:false});
});
