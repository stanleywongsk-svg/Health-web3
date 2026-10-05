import { describe, expect, it, vi } from 'vitest';
import { createMissionClaimRecovery } from './mission-claim';
import { CoreApiError } from '@healthloop/api-client';
const result={instanceId:'mission-a',addedPoints:10,dailyAwardedPoints:10,weeklyAwardedPoints:0,balance:10};
function setup(){const api={claimMission:vi.fn(async()=>result)};let n=0;const recovery=createMissionClaimRecovery(api,()=>`request-${++n}`);recovery.setAccount('account-a');return{api,recovery,signal:new AbortController().signal}}
describe('accepted mission recovery',()=>{
  it('rechecks release capability before a claim retry while preserving the original key',async()=>{
    let allowed=true;const api={claimMission:vi.fn(async()=>result)};let n=0;
    const recovery=createMissionClaimRecovery(api,()=>`request-${++n}`,()=>{if(!allowed)throw new CoreApiError('RELEASE_POLICY_REQUIRED',0)});recovery.setAccount('account-a');
    const signal=new AbortController().signal;api.claimMission.mockRejectedValueOnce(new Error('response lost'));
    await expect(recovery.claim('mission-a',signal)).rejects.toThrow('response lost');allowed=false;
    await expect(recovery.claim('mission-a',signal)).rejects.toMatchObject({code:'RELEASE_POLICY_REQUIRED'});expect(api.claimMission).toHaveBeenCalledOnce();
    allowed=true;await recovery.claim('mission-a',signal);expect(api.claimMission.mock.calls).toEqual([['mission-a','request-1',signal],['mission-a','request-1',signal]]);
  });
  it('reuses the original request after a lost server response',async()=>{
    const {api,recovery,signal}=setup();api.claimMission.mockRejectedValueOnce(new Error('response lost'));
    await expect(recovery.claim('mission-a',signal)).rejects.toThrow('response lost');
    expect(await recovery.claim('mission-a',signal)).toEqual(result);
    expect(api.claimMission.mock.calls).toEqual([['mission-a','request-1',signal],['mission-a','request-1',signal]]);
  });
  it('does not repost while retrying a failed canonical refresh',async()=>{
    const {api,recovery,signal}=setup();await recovery.claim('mission-a',signal);await recovery.claim('mission-a',signal);
    expect(api.claimMission).toHaveBeenCalledTimes(1);recovery.confirmed('mission-a');
    await recovery.claim('mission-a',signal);expect(api.claimMission.mock.calls.at(-1)).toEqual(['mission-a','request-2',signal]);
  });
  it('coalesces concurrent taps into one claim',async()=>{
    const {api,recovery,signal}=setup();await Promise.all(Array.from({length:10},()=>recovery.claim('mission-a',signal)));
    expect(api.claimMission).toHaveBeenCalledTimes(1);
  });
  it('drops late responses after withdrawal or account change',async()=>{
    for(const change of ['withdrawal','account']){
      const {api,recovery,signal}=setup();let resolve!:(value:typeof result)=>void;
      api.claimMission.mockImplementationOnce(()=>new Promise(done=>{resolve=done}));
      const pending=recovery.claim('mission-a',signal);
      if(change==='withdrawal')recovery.clear();else recovery.setAccount('account-b');
      resolve(result);await expect(pending).rejects.toMatchObject({code:'CANCELLED'});
      await recovery.claim('mission-a',signal);expect(api.claimMission.mock.calls.at(-1)).toEqual(['mission-a','request-2',signal]);
    }
  });
  it('rejects cancelled or signed-out requests before transport',async()=>{
    const {api,recovery}=setup();const abort=new AbortController();abort.abort();
    await expect(recovery.claim('mission-a',abort.signal)).rejects.toMatchObject({code:'CANCELLED'});
    recovery.setAccount(null);await expect(recovery.claim('mission-a',new AbortController().signal)).rejects.toMatchObject({code:'UNAUTHENTICATED'});expect(api.claimMission).not.toHaveBeenCalled();
  });
});
