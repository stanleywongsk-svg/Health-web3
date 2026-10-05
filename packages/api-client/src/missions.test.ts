import { describe, expect, it, vi } from 'vitest';
import { createCoreClient } from './index';
import { missionsResultSchema } from '@healthloop/domain';

const daily={id:'00000000-0000-4000-8000-000000000001',kind:'daily_steps',periodStart:'2026-10-05',ruleVersion:'steps-v1',selectedGoal:3000,awardedPoints:10,eligibleSteps:3000,cutoffAt:'2026-10-06T04:00:00Z',tiers:[{steps:3000,points:10},{steps:5000,points:20},{steps:7000,points:30}],weeklyDaysRequired:3,weeklyBonusPoints:20,qualifyingDates:[],pendingReview:false};
const weekly={...daily,id:'00000000-0000-4000-8000-000000000002',kind:'weekly_consistency',eligibleSteps:null,awardedPoints:0,qualifyingDates:['2026-10-05']};
const response={serverNow:'2026-10-05T01:00:00Z',taskDate:'2026-10-05',timezone:'Asia/Hong_Kong',items:[daily,weekly]};
const client=(data:unknown)=>createCoreClient({baseUrl:'http://localhost:54321/functions/v1/core',accessToken:async()=>'synthetic-session',fetch:async()=>Response.json({data,requestId:'missions-test'})});
describe('canonical mission progress contract',()=>{
  it('reads own progress without a user ID, client date or reward amount',async()=>{
    const send=vi.fn(async()=>Response.json({data:response,requestId:'missions-test'}));
    const api=createCoreClient({baseUrl:'http://localhost:54321/functions/v1/core',accessToken:async()=>'synthetic-session',fetch:send});
    expect(await api.getMissions()).toEqual(response);
    expect(send.mock.calls[0]).toEqual(['http://localhost:54321/functions/v1/core/missions',expect.objectContaining({method:'GET',body:undefined})]);
  });
  it('preserves null health data, confirmed zero and pending review as distinct facts',async()=>{
    for(const eligibleSteps of [null,0]) expect((await client({...response,items:[{...daily,eligibleSteps,pendingReview:true}]}).getMissions()).items[0]).toMatchObject({eligibleSteps,pendingReview:true});
  });
  it.each([
    {...response,taskDate:'2026-10-06'},
    {...response,items:[daily,daily]},
    {...response,items:[{...weekly,qualifyingDates:['2026-10-05','2026-10-05']}]},
    {...response,items:[{...weekly,qualifyingDates:['2026-10-12']}]},
    {...response,items:[{...weekly,awardedPoints:30}]},
    {...response,items:[{...daily,eligibleSteps:-1}]},
    {...response,items:[{...daily,rawSamples:[]}]},
    {...response,items:[{...daily,tiers:[{steps:5000,points:20},{steps:3000,points:10}]}]},
    {...response,items:[{...daily,cutoffAt:'bad'}]},
  ])('rejects inconsistent or overbroad progress',async data=>{
    expect(missionsResultSchema.safeParse(data).success).toBe(false);
    await expect(client(data).getMissions()).rejects.toMatchObject({code:'INVALID_RESPONSE'});
  });
});
