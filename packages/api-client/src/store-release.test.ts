import { describe, expect, it, vi } from 'vitest';
import { IOS_RELEASE_POLICY } from '@healthloop/domain';
import { createCoreClient } from './index';
const badges={items:[{id:'first_steps',earned:true,earnedOn:'2026-10-05'},{id:'consistent_week',earned:false,earnedOn:null}],evaluatedAt:'2026-10-05T01:00:00Z'};
const client=(data:unknown)=>createCoreClient({baseUrl:'http://localhost/core',accessToken:async()=>'synthetic-session',fetch:async()=>Response.json({data,requestId:'release-test'})});
describe('fixed App Store policy and server-derived badges',()=>{
  it('keeps the release policy deeply immutable and rejects remote enabling',async()=>{
    expect(Object.isFrozen(IOS_RELEASE_POLICY)).toBe(true);expect(Object.isFrozen(IOS_RELEASE_POLICY.features)).toBe(true);
    expect(await client(IOS_RELEASE_POLICY).getCapabilities()).toEqual(IOS_RELEASE_POLICY);
    for(const feature of ['walletConnection','nftPurchases','cryptoRewards','rewardedAds','inAppPurchases','demoRedemptions']) {
      await expect(client({...IOS_RELEASE_POLICY,features:{...IOS_RELEASE_POLICY.features,[feature]:true}}).getCapabilities()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
    }
    await expect(client({...IOS_RELEASE_POLICY,policyVersion:'remote-v2'}).getCapabilities()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
    await expect(client({...IOS_RELEASE_POLICY,providerAccount:'hidden'}).getCapabilities()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
  it('fetches authenticated canonical badges without client health, identity, wallet or reward inputs',async()=>{
    const send=vi.fn(async()=>Response.json({data:badges,requestId:'release-test'}));
    const api=createCoreClient({baseUrl:'http://localhost/core',accessToken:async()=>'synthetic-session',fetch:send});
    expect(await api.getBadges()).toEqual(badges);
    expect(send.mock.calls[0]).toEqual(['http://localhost/core/badges',expect.objectContaining({method:'GET',body:undefined})]);
  });
  it.each([
    {...badges,items:[badges.items[0],badges.items[0]]},
    {...badges,items:[{id:'first_steps',earned:true,earnedOn:null},badges.items[1]]},
    {...badges,items:[badges.items[0],{id:'consistent_week',earned:false,earnedOn:'2026-10-05'}]},
    {...badges,items:[badges.items[0],{id:'consistent_week',earned:true,earnedOn:'2026-10-06'}]},
    {...badges,items:[{...badges.items[0],earnedOn:'2026-10-06'},badges.items[1]]},
    {...badges,items:[{...badges.items[0],eligibleSteps:3000},badges.items[1]]},
    {...badges,accountId:'private'}, {...badges,evaluatedAt:'yesterday'},
  ])('rejects inconsistent, future or excessive badge payloads',async data=>{
    await expect(client(data).getBadges()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
  it('cancels requests and preserves account status errors',async()=>{
    const aborted=new AbortController();aborted.abort();
    await expect(client(badges).getBadges(aborted.signal)).rejects.toMatchObject({code:'CANCELLED'});
    const api=createCoreClient({baseUrl:'http://localhost/core',accessToken:async()=>'synthetic-session',fetch:async()=>Response.json({error:{code:'ACCOUNT_INACTIVE'}},{status:403})});
    await expect(api.getBadges()).rejects.toMatchObject({code:'ACCOUNT_INACTIVE',status:403});
  });
});
