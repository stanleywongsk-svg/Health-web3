import { describe, expect, it, vi } from 'vitest';
import { CoreApiError, type CoreClient, type PointsSummary } from '@healthloop/api-client';
import { RewardController, rewardIntentKey, rewardCancellationKey } from './reward-controller';
import { createChunkedStorage } from './secure-storage-core';
const rewardId='47d2e940-06c8-4f1e-824c-8e8e9b02568a';
const redemptionId='1af68936-33f6-4b7a-8560-83cbce0b8bbd';
const key='08b11a86-38da-4c2f-a2ad-9df57ea4bb95';
const code='697ad8e0-8a5b-4f15-ad47-3cde91d3be93';
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}};
const points=(balance=50):PointsSummary=>({balance,availablePoints:Math.max(0,balance),pendingEvaluations:0,earnedPoints:50,spentPoints:50-balance,reversedPoints:0,correctionPoints:0});
function fixture(){
  const data=new Map<string,string>();
  const storage={getItem:async(k:string)=>data.get(k)??null,setItem:async(k:string,v:string)=>{data.set(k,v)},removeItem:async(k:string)=>{data.delete(k)}};
  const reward={id:rewardId,titleKey:'rewards.demoBadge',pointsCost:20,stock:2,isDemo:true as const};
  const redemption={id:redemptionId,rewardId,status:'demonstration' as const,demoCode:code,pointsCost:20,createdAt:'2026-09-20T01:00:00Z'};
  const api={
    getRewards:vi.fn<CoreClient['getRewards']>().mockResolvedValue({items:[reward]}),
    getRedemptions:vi.fn<CoreClient['getRedemptions']>().mockResolvedValue({items:[],nextCursor:null}),
    getPointsSummary:vi.fn<CoreClient['getPointsSummary']>().mockResolvedValue(points()),
    getLedger:vi.fn<CoreClient['getLedger']>().mockResolvedValue({items:[],nextCursor:null}),
    redeemReward:vi.fn<CoreClient['redeemReward']>().mockImplementation(async()=>{api.getRedemptions.mockResolvedValue({items:[redemption],nextCursor:null});api.getRewards.mockResolvedValue({items:[{...reward,stock:1}]});api.getPointsSummary.mockResolvedValue(points(30));return {id:redemptionId,status:'demonstration',demoCode:code,pointsCost:20}}),
    cancelRedemption:vi.fn<CoreClient['cancelRedemption']>().mockImplementation(async()=>{api.getRedemptions.mockResolvedValue({items:[{...redemption,status:'cancelled'}],nextCursor:null});api.getRewards.mockResolvedValue({items:[reward]});api.getPointsSummary.mockResolvedValue(points());return {id:redemptionId,status:'cancelled'}}),
  };
  const randomUUID=vi.fn(()=>key);
  const make=()=>{const controller=new RewardController({api,storage,randomUUID});controller.setContext({accountId:'a',verified:true,redeemAllowed:true});return controller};
  return {api,storage,data,reward,redemption,randomUUID,make};
}
describe('mobile demonstration reward controller',()=>{
  it('coalesces a double click into one debit request with one stable key',async()=>{
    const f=fixture();const c=f.make();await c.refresh();const first=c.redeem(rewardId);const second=c.redeem(rewardId);
    expect(first).toBe(second);const result=await first;expect(f.api.redeemReward).toHaveBeenCalledTimes(1);expect(f.randomUUID).toHaveBeenCalledTimes(1);expect(result.points.availablePoints).toBe(30);expect(result.rewards[0]!.stock).toBe(1);expect(c.getSnapshot().pending).toBeNull();expect(f.data.size).toBe(0);
  });
  it('recovers a lost response after restart with the original key and no new debit',async()=>{
    const f=fixture();const applied=f.api.redeemReward.getMockImplementation()!;
    f.api.redeemReward.mockImplementationOnce(async(...args)=>{await applied(...args);throw new CoreApiError('NETWORK_ERROR',0)});
    const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'NETWORK_ERROR'});
    const stored=f.data.get(rewardIntentKey('a'))!;expect(stored).not.toContain(code);expect(stored).not.toContain('demoCode');
    const reopened=f.make();await reopened.refresh();await reopened.retry();expect(f.api.redeemReward.mock.calls.map(call=>call[0])).toEqual([{rewardId,idempotencyKey:key},{rewardId,idempotencyKey:key}]);expect(f.randomUUID).toHaveBeenCalledTimes(1);expect(reopened.getSnapshot().points!.availablePoints).toBe(30);
  });
  it('reports no success before canonical accounting is fetched, then retries reads only',async()=>{
    const f=fixture();const c=f.make();await c.refresh();const applied=f.api.redeemReward.getMockImplementation()!;
    f.api.redeemReward.mockImplementationOnce(async(...args)=>{const result=await applied(...args);f.api.getLedger.mockRejectedValueOnce(new CoreApiError('TIMEOUT',0));return result});
    await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'TIMEOUT'});expect(c.getSnapshot()).toMatchObject({ready:false,pending:{stage:'refresh'}});
    await c.retry();expect(f.api.redeemReward).toHaveBeenCalledTimes(1);expect(c.getSnapshot().ready).toBe(true);expect(c.getSnapshot().pending).toBeNull();
  });
  it('a late response from A cannot reveal codes or alter B after an account switch',async()=>{
    const f=fixture();const c=f.make();await c.refresh();const response=deferred<Awaited<ReturnType<CoreClient['redeemReward']>>>();f.api.redeemReward.mockReturnValueOnce(response.promise);
    const old=c.redeem(rewardId);while(f.api.redeemReward.mock.calls.length===0)await Promise.resolve();
    c.setContext({accountId:'b',verified:true,redeemAllowed:true});await c.refresh();response.resolve({id:redemptionId,status:'demonstration',demoCode:code,pointsCost:20});
    await expect(old).rejects.toMatchObject({code:'CANCELLED'});expect(c.getSnapshot()).toMatchObject({accountId:'b',pending:null,redemptions:{items:[]}});expect(f.data.has(rewardIntentKey('a'))).toBe(true);
  });
  it('stops new requests while offline or cloud consent is unconfirmed',async()=>{
    const f=fixture();const c=f.make();await c.refresh();c.setContext({accountId:'a',verified:false,redeemAllowed:false});expect(()=>c.redeem(rewardId)).toThrow('RECONNECT_REQUIRED');
    c.setContext({accountId:'a',verified:true,redeemAllowed:false});await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'CONSENT_REQUIRED'});expect(f.api.redeemReward).not.toHaveBeenCalled();
  });
  it.each([0,-10])('cannot spend unavailable points when raw balance is %s',async balance=>{
    const f=fixture();f.api.getPointsSummary.mockResolvedValue(points(balance));const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'INSUFFICIENT_POINTS'});expect(f.api.redeemReward).not.toHaveBeenCalled();
  });
  it('blocks empty inventory and non-demo catalogues',async()=>{
    const f=fixture();f.api.getRewards.mockResolvedValue({items:[{...f.reward,stock:0}]});const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'OUT_OF_STOCK'});
    f.api.getRewards.mockResolvedValue({items:[{...f.reward,isDemo:false as true}]});await expect(c.refresh()).rejects.toMatchObject({code:'INVALID_RESPONSE'});expect(c.getSnapshot().ready).toBe(false);
  });
  it('allows cancellation and canonical refund after cloud consent withdrawal',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.redeem(rewardId);c.setContext({accountId:'a',verified:true,redeemAllowed:false});
    const result=await c.cancel(redemptionId);expect(result.redemptions.items[0]!.status).toBe('cancelled');expect(result.points.availablePoints).toBe(50);expect(result.rewards[0]!.stock).toBe(2);
  });
  it('coalesces duplicate cancellation and safely retries a lost cancellation response',async()=>{
    const f=fixture();f.api.getRedemptions.mockResolvedValue({items:[f.redemption],nextCursor:null});const c=f.make();await c.refresh();
    const applied=f.api.cancelRedemption.getMockImplementation()!;f.api.cancelRedemption.mockImplementationOnce(async(...args)=>{await applied(...args);throw new CoreApiError('NETWORK_ERROR',0)});
    const first=c.cancel(redemptionId);expect(c.cancel(redemptionId)).toBe(first);await expect(first).rejects.toMatchObject({code:'NETWORK_ERROR'});expect(f.data.has(rewardCancellationKey('a'))).toBe(true);
    await c.retry();expect(f.api.cancelRedemption.mock.calls.map(call=>call[0])).toEqual([redemptionId,redemptionId]);expect(c.getSnapshot().points!.availablePoints).toBe(50);
  });
  it('does not make refund depend on resolving a lost redemption after withdrawal',async()=>{
    const f=fixture();const applied=f.api.redeemReward.getMockImplementation()!;f.api.redeemReward.mockImplementationOnce(async(...args)=>{await applied(...args);throw new CoreApiError('NETWORK_ERROR',0)});
    const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toThrow();c.setContext({accountId:'a',verified:true,redeemAllowed:false});await c.refresh();
    await c.cancel(redemptionId);expect(c.getSnapshot().points!.availablePoints).toBe(50);expect(f.data.has(rewardIntentKey('a'))).toBe(true);expect(f.data.has(rewardCancellationKey('a'))).toBe(false);expect(c.getSnapshot().pending?.kind).toBe('redeem');
  });
  it('can reconcile an existing key after withdrawal without permitting a new redemption',async()=>{
    const f=fixture();const applied=f.api.redeemReward.getMockImplementation()!;f.api.redeemReward.mockImplementationOnce(async(...args)=>{await applied(...args);throw new CoreApiError('NETWORK_ERROR',0)});
    const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toThrow();c.setContext({accountId:'a',verified:true,redeemAllowed:false});
    await c.retry();expect(f.api.redeemReward.mock.calls[1]![0]).toEqual({rewardId,idempotencyKey:key});expect(c.getSnapshot().pending).toBeNull();await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
  });
  it('preserves the original key when an uncommitted request cannot be retried after withdrawal',async()=>{
    const f=fixture();f.api.redeemReward.mockRejectedValueOnce(new CoreApiError('NETWORK_ERROR',0));const c=f.make();await c.refresh();await expect(c.redeem(rewardId)).rejects.toThrow();
    c.setContext({accountId:'a',verified:true,redeemAllowed:false});f.api.redeemReward.mockRejectedValueOnce(new CoreApiError('CONSENT_REQUIRED',403));await expect(c.retry()).rejects.toMatchObject({code:'CONSENT_REQUIRED'});
    expect(c.getSnapshot().pending).toMatchObject({idempotencyKey:key});expect(f.data.has(rewardIntentKey('a'))).toBe(true);expect(f.randomUUID).toHaveBeenCalledTimes(1);
  });
  it('clears a definitively uncommitted legacy intent after the shipping policy disables new demonstrations',async()=>{
    const f=fixture();f.data.set(rewardIntentKey('a'),JSON.stringify({version:1,kind:'redeem',rewardId,idempotencyKey:key,stage:'request'}));
    const c=f.make();c.setContext({accountId:'a',verified:true,redeemAllowed:false});await c.refresh();
    f.api.redeemReward.mockRejectedValue(new CoreApiError('NOT_SUPPORTED',404));
    await expect(c.retry()).rejects.toMatchObject({code:'NOT_SUPPORTED'});
    expect(c.getSnapshot().pending).toBeNull();expect(f.data.has(rewardIntentKey('a'))).toBe(false);expect(f.randomUUID).not.toHaveBeenCalled();
    expect(c.getSnapshot().points?.availablePoints).toBe(50);
  });
  it('does not post a new redemption if intent persistence fails',async()=>{
    const f=fixture();const c=f.make();await c.refresh();f.storage.setItem=async()=>{throw new Error('keychain unavailable')};await expect(c.redeem(rewardId)).rejects.toThrow();expect(f.api.redeemReward).not.toHaveBeenCalled();
  });
  it('rejects a corrupt pending intent rather than creating another key',async()=>{
    const f=fixture();f.data.set(rewardIntentKey('a'),JSON.stringify({kind:'redeem',rewardId}));const c=f.make();await expect(c.refresh()).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});expect(f.api.redeemReward).not.toHaveBeenCalled();
  });
  it.each(['account-switch','reverify'])('keeps the original intent through a delayed Keychain write and %s',async mode=>{
    const f=fixture();const data=new Map<string,string>();const entered=deferred<void>();const release=deferred<void>();let pause=true;let serial=0;
    const storage=createChunkedStorage({get:async k=>data.get(k)??null,set:async(k,v)=>{if(pause&&k.startsWith('hl.reward-intent.v1.a.')){pause=false;entered.resolve();await release.promise}data.set(k,v)},remove:async k=>{data.delete(k)}},()=>String(++serial));
    const c=new RewardController({api:f.api,storage,randomUUID:f.randomUUID});c.setContext({accountId:'a',verified:true,redeemAllowed:true});await c.refresh();
    const old=c.redeem(rewardId);const rejected=expect(old).rejects.toMatchObject({code:'CANCELLED'});await entered.promise;
    c.setContext({accountId:mode==='account-switch'?'b':'a',verified:false,redeemAllowed:false});c.setContext({accountId:'a',verified:true,redeemAllowed:true});
    const restored=c.refresh();expect(f.api.redeemReward).not.toHaveBeenCalled();release.resolve();await rejected;await restored;
    expect(c.getSnapshot().pending).toMatchObject({idempotencyKey:key});await c.retry();expect(f.api.redeemReward).toHaveBeenCalledTimes(1);expect(f.randomUUID).toHaveBeenCalledTimes(1);
    expect(await storage.getItem(rewardIntentKey('a'))).toBeNull();
  });
  it.each(['account-switch','reverify'])('orders delayed intent removal before restored state and later intent during %s',async mode=>{
    const f=fixture();const data=new Map<string,string>();const entered=deferred<void>();const release=deferred<void>();let pause=true;let serial=0;
    const storage=createChunkedStorage({get:async k=>data.get(k)??null,set:async(k,v)=>{data.set(k,v)},remove:async k=>{if(pause&&k==='hl.reward-intent.v1.a'){pause=false;entered.resolve();await release.promise}data.delete(k)}},()=>String(++serial));
    const c=new RewardController({api:f.api,storage,randomUUID:f.randomUUID});c.setContext({accountId:'a',verified:true,redeemAllowed:true});await c.refresh();
    const old=c.redeem(rewardId);const rejected=expect(old).rejects.toMatchObject({code:'CANCELLED'});await entered.promise;
    c.setContext({accountId:mode==='account-switch'?'b':'a',verified:false,redeemAllowed:false});c.setContext({accountId:'a',verified:true,redeemAllowed:true});
    const restored=c.refresh();release.resolve();await rejected;await restored;
    if(c.getSnapshot().pending)await c.retry(); // Same-account memory may retain the already-acknowledged refresh stage.
    expect(f.api.redeemReward).toHaveBeenCalledTimes(1);expect(await storage.getItem(rewardIntentKey('a'))).toBeNull();
    const nextKey='c768ceaa-d1c3-47f4-a47d-537e1f6e02de';f.randomUUID.mockReturnValue(nextKey);f.api.redeemReward.mockRejectedValueOnce(new CoreApiError('NETWORK_ERROR',0));
    await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'NETWORK_ERROR'});expect(JSON.parse((await storage.getItem(rewardIntentKey('a')))!)).toMatchObject({idempotencyKey:nextKey});
  });
  it('never replaces a newly awarded balance with an older catalogue refresh',async()=>{
    const f=fixture();const c=f.make();await c.refresh();const oldPoints=deferred<PointsSummary>();f.api.getPointsSummary.mockReturnValueOnce(oldPoints.promise);
    const old=c.refresh();const rejected=expect(old).rejects.toMatchObject({code:'CANCELLED'});while(f.api.getPointsSummary.mock.calls.length<2)await Promise.resolve();
    const fresh={...points(),earnedPoints:70,balance:70,availablePoints:70};const ledger={items:[],nextCursor:null};c.updateAccounting(fresh,ledger);oldPoints.resolve(points());await rejected;
    expect(c.getSnapshot().points).toBe(fresh);expect(c.getSnapshot().ready).toBe(false);await expect(c.redeem(rewardId)).rejects.toMatchObject({code:'REWARDS_REFRESH_REQUIRED'});
  });
  it('a late initial restore cannot forget an intent created after a newer refresh completed',async()=>{
    const f=fixture();const oldRead=deferred<string|null>();const original=f.storage.getItem;let delay=true;
    f.storage.getItem=async k=>{if(k===rewardIntentKey('a')&&delay){delay=false;return oldRead.promise}return original(k)};
    const c=f.make();const old=c.refresh();const rejected=expect(old).rejects.toMatchObject({code:'CANCELLED'});
    await c.refresh();f.api.redeemReward.mockRejectedValueOnce(new CoreApiError('NETWORK_ERROR',0));await expect(c.redeem(rewardId)).rejects.toThrow();
    oldRead.resolve(null);await rejected;expect(c.getSnapshot().pending).toMatchObject({idempotencyKey:key});await c.refresh();await c.redeem(rewardId);
    expect(f.randomUUID).toHaveBeenCalledTimes(1);expect(f.api.redeemReward.mock.calls.map(call=>call[0].idempotencyKey)).toEqual([key,key]);
  });
  it('keeps acknowledged redemption retryable when fresher accounting overtakes its canonical refresh',async()=>{
    const f=fixture();const c=f.make();await c.refresh();const oldPoints=deferred<PointsSummary>();const applied=f.api.redeemReward.getMockImplementation()!;
    f.api.redeemReward.mockImplementationOnce(async(...args)=>{const result=await applied(...args);f.api.getPointsSummary.mockReturnValueOnce(oldPoints.promise);return result});
    const old=c.redeem(rewardId);const rejected=expect(old).rejects.toMatchObject({code:'CANCELLED'});while(f.api.getPointsSummary.mock.calls.length<2)await Promise.resolve();
    const fresh={...points(30),earnedPoints:70,balance:50,availablePoints:50};c.updateAccounting(fresh,{items:[],nextCursor:null});oldPoints.resolve(points(30));await rejected;
    expect(c.getSnapshot()).toMatchObject({points:fresh,pending:{stage:'refresh'},ready:false});f.api.getPointsSummary.mockResolvedValue(fresh);await c.retry();expect(f.api.redeemReward).toHaveBeenCalledTimes(1);expect(c.getSnapshot().points).toBe(fresh);
  });
});
