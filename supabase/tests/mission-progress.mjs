/** Canonical X to Earn progress. Synthetic identities; real PostgreSQL transactions. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runMissionProgressTests({ admin,rpc,user,clock,sync,check,rejected }) {
  const missions=id=>rpc(id,'hl_missions');
  const find=(result,kind,date)=>result.items.find(m=>m.kind===kind&&m.periodStart===date);
  await clock('2026-09-21T01:00:00Z');
  const a=await user(), b=await user(false);
  await check('mission progress exposes server time and pinned rules without inventing health or posting points',async()=>{
    const result=await missions(a);
    assert.equal(result.taskDate,'2026-09-21');assert.equal(result.timezone,'Asia/Hong_Kong');
    assert.equal(Date.parse(result.serverNow),Date.parse('2026-09-21T01:00:00Z'));
    assert.equal(find(result,'daily_steps','2026-09-21').eligibleSteps,null);
    assert.deepEqual(find(result,'weekly_consistency','2026-09-21').qualifyingDates,[]);
    assert.equal((await rpc(a,'hl_points_summary')).balance,0);
    assert.deepEqual((await rpc(a,'hl_ledger')).items,[]);
    assert.equal((await missions(b)).items.length,2); // Reading rules needs no optional cloud consent.
  });
  await check('weekly progress uses distinct accepted days and stays separate from posted awards',async()=>{
    for(const day of ['2026-09-21','2026-09-22','2026-09-23']){
      await clock(`${day}T01:00:00Z`);await sync(a,7000,1,day);await sync(a,7000,1,day);
    }
    const result=await missions(a);const weekly=find(result,'weekly_consistency','2026-09-21');
    assert.deepEqual(weekly.qualifyingDates,['2026-09-21','2026-09-22','2026-09-23']);assert.equal(weekly.awardedPoints,0);
    await rpc(a,'hl_claim',[find(result,'daily_steps','2026-09-23').id,randomUUID()]);
    assert.equal(find(await missions(a),'weekly_consistency','2026-09-21').awardedPoints,20);
    assert.deepEqual(find(await missions(b),'weekly_consistency','2026-09-21').qualifyingDates,[]);
  });
  await check('pending revisions are visible but cannot replace canonical progress or manufacture extra rewards',async()=>{
    assert.equal((await sync(a,0,2,'2026-09-23')).status,'pending_review');
    const result=await missions(a);const daily=find(result,'daily_steps','2026-09-23');const weekly=find(result,'weekly_consistency','2026-09-21');
    assert.equal(daily.eligibleSteps,7000);assert.equal(daily.pendingReview,true);assert.equal(daily.awardedPoints,30);
    assert.equal(weekly.pendingReview,true);assert.equal(weekly.qualifyingDates.length,3);assert.equal(weekly.awardedPoints,20);
    assert.equal(find(await missions(b),'daily_steps','2026-09-23').pendingReview,false);
    const c=await user();await sync(c,60000,1,'2026-09-23');
    assert.equal(find(await missions(c),'daily_steps','2026-09-23').eligibleSteps,null);
    assert.equal(find(await missions(c),'weekly_consistency','2026-09-21').qualifyingDates.length,0);
  });
  await check('server midnight starts the new day and Monday starts an empty independent week',async()=>{
    await clock('2026-09-23T15:59:59Z');assert.equal((await missions(a)).taskDate,'2026-09-23');
    await clock('2026-09-23T16:00:00Z');assert.equal((await missions(a)).taskDate,'2026-09-24');
    await clock('2026-09-27T16:00:00Z');const result=await missions(a);
    assert.equal(result.taskDate,'2026-09-28');assert.deepEqual(find(result,'weekly_consistency','2026-09-28').qualifyingDates,[]);
    assert.equal(find(result,'weekly_consistency','2026-09-21').awardedPoints,20);
  });
  await check('progress keeps the week goal pinned across newly published daily rules',async()=>{
    await clock('2026-09-21T01:00:00Z');const c=await user();
    const baseline=await missions(c);const oldWeek=find(baseline,'weekly_consistency','2026-09-21');
    await admin.query("insert into public.mission_versions(version,effective_from,weekly_goal) values('progress-rules-v2','2026-09-22',$1)",[oldWeek.selectedGoal===7000?3000:7000]);
    await clock('2026-09-22T01:00:00Z');await sync(c,oldWeek.selectedGoal,1,'2026-09-22');
    const result=await missions(c);
    assert.equal(find(result,'daily_steps','2026-09-22').ruleVersion,'progress-rules-v2');
    assert.equal(find(result,'weekly_consistency','2026-09-21').selectedGoal,oldWeek.selectedGoal);
    assert.deepEqual(find(result,'weekly_consistency','2026-09-21').qualifyingDates,['2026-09-22']);
  });
  await check('inactive and anonymous accounts cannot read mission progress',async()=>{
    await rejected(()=>rpc(a,'hl_missions',[],{is_anonymous:true}),'UNAUTHENTICATED');
    await admin.query("update public.profiles set status='deletion_requested' where id=$1",[b]);
    await rejected(()=>missions(b),'ACCOUNT_INACTIVE');
    assert.equal((await admin.query("select has_function_privilege('anon','public.hl_missions()','execute') permitted")).rows[0].permitted,false);
  });
}
