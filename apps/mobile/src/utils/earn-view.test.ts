import { describe, expect, it } from 'vitest';
import type { Mission, MissionsResult } from '@healthloop/api-client';
import { earnView, type EarnInput } from './earn-view';

const daily:Mission={id:'00000000-0000-4000-8000-000000000001',kind:'daily_steps',periodStart:'2026-10-05',ruleVersion:'steps-v1',selectedGoal:3000,awardedPoints:0,eligibleSteps:null,cutoffAt:'2026-10-06T04:00:00Z',tiers:[{steps:3000,points:10},{steps:5000,points:20},{steps:7000,points:30}],weeklyDaysRequired:3,weeklyBonusPoints:20,qualifyingDates:[],pendingReview:false};
const weekly:Mission={...daily,id:'00000000-0000-4000-8000-000000000002',kind:'weekly_consistency',cutoffAt:'2026-10-12T04:00:00Z'};
const snapshot:MissionsResult={taskDate:'2026-10-05',serverNow:'2026-10-05T01:00:00Z',timezone:'Asia/Hong_Kong',items:[daily,weekly]};
const input=(changes:Partial<EarnInput>={}):EarnInput=>({date:'2026-10-05',snapshot,eligible:{status:'present',value:5000},canSubmit:true,localAllowed:true,cloudReady:true,online:true,releaseReady:true,pendingDates:[],...changes});
const withDaily=(changes:Partial<Mission>):MissionsResult=>({...snapshot,items:[{...daily,...changes},weekly]});

describe('activity points presentation and next actions',()=>{
  it.each([[0,0],[2999,0],[3000,10],[4999,10],[5000,20],[6999,20],[7000,30],[9000,30]])('previews only highest tier at %i steps', (steps,points)=>{
    const result=earnView(input({eligible:{status:'present',value:steps}}));
    expect(result.preview).toBe(points);expect(result.daily?.awardedPoints).toBe(0);
  });
  it('previews a top-up without treating it as posted points',()=>{
    const result=earnView(input({snapshot:withDaily({awardedPoints:10,eligibleSteps:3000})}));
    expect(result.preview).toBe(10);expect(result.action).toBe('sync');expect(result.daily?.awardedPoints).toBe(10);
  });
  it('never turns missing, failed or invalid local records into zero progress',()=>{
    for(const eligible of [undefined,{status:'no_data' as const},{status:'unavailable' as const},{status:'error' as const,code:'query_failed' as const},{status:'present' as const,value:NaN}]){
      const result=earnView(input({eligible}));expect(result.preview).toBeNull();expect(result.fraction).toBeNull();expect(result.action).toBe('read');
    }
    expect(earnView(input({eligible:{status:'present',value:0}}))).toMatchObject({preview:0,fraction:0});
  });
  it('uses pinned server goals and preserves weekly canonical dates',()=>{
    const custom={...snapshot,items:[{...daily,selectedGoal:5000 as const},{...weekly,qualifyingDates:['2026-10-05']}]};
    const result=earnView(input({snapshot:custom,eligible:{status:'present',value:3000}}));
    expect(result.fraction).toBe(.6);expect(result.weekly?.qualifyingDates).toEqual(['2026-10-05']);
  });
  it('requires a refresh after Hong Kong day or week rollover instead of applying yesterday rules',()=>{
    expect(earnView(input({date:'2026-10-06'}))).toMatchObject({action:'reload',preview:null});
    expect(earnView(input({date:'2026-10-12'})).weekly).toBeUndefined();
    expect(earnView(input({snapshot:null})).action).toBe('reload');
  });
  it('guides offline, consent, original retry and manual review before new submissions',()=>{
    expect(earnView(input({online:false})).action).toBe('reconnect');
    expect(earnView(input({releaseReady:false})).action).toBe('release');
    expect(earnView(input({releaseReady:false,pendingDates:['2026-10-05']})).action).toBe('release');
    expect(earnView(input({cloudReady:false})).action).toBe('consent');
    expect(earnView(input({localAllowed:false,pendingDates:['2026-10-05']})).action).toBe('consent');
    expect(earnView(input({pendingDates:['2026-10-05'],snapshot:withDaily({pendingReview:true})})).action).toBe('retry');
    expect(earnView(input({snapshot:withDaily({pendingReview:true})})).action).toBe('review');
    expect(earnView(input({canSubmit:false})).action).toBe('read');
  });
  it('claims accepted server progress even when local readings are no longer available',()=>{
    const result=earnView(input({eligible:undefined,canSubmit:false,snapshot:withDaily({eligibleSteps:3000})}));
    expect(result).toMatchObject({action:'claim',claimId:daily.id,preview:null});
    const weeklyReady={...snapshot,taskDate:'2026-10-07',serverNow:'2026-10-07T01:00:00Z',items:[{...daily,periodStart:'2026-10-07'}, {...weekly,qualifyingDates:['2026-10-05','2026-10-06','2026-10-07']}]};
    expect(earnView(input({date:'2026-10-07',snapshot:weeklyReady}))).toMatchObject({action:'claim',claimId:weekly.id});
  });
  it('does not offer a direct claim after its server cutoff',()=>{
    expect(earnView(input({snapshot:withDaily({eligibleSteps:3000,cutoffAt:'2026-10-05T01:00:00Z'})})).claimId).toBeNull();
  });
  it('opens rewards once canonical totals match, without prompting more exercise',()=>{
    expect(earnView(input({snapshot:withDaily({awardedPoints:20,eligibleSteps:5000})}))).toMatchObject({action:'rewards',preview:0});
  });
  it('keeps a lower local revision separate from confirmed entitlement',()=>{
    const result=earnView(input({eligible:{status:'present',value:3000},snapshot:withDaily({awardedPoints:30,eligibleSteps:7000})}));
    expect(result.preview).toBe(0);expect(result.daily?.awardedPoints).toBe(30);expect(result.action).toBe('sync');
  });
});
