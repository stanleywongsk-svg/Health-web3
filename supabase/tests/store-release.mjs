/** Release policy and noncash achievement evidence using synthetic accounts and real SQL. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runStoreReleaseTests({admin,rpc,session,user,clock,sync,check,rejected,withDemoRedemptions}) {
  await clock('2026-09-21T01:00:00Z');
  const a=await user(), b=await user(false);
  const badges=id=>rpc(id,'hl_badges');
  const item=(result,id)=>result.items.find(i=>i.id===id);
  const empty=[{id:'first_steps',earned:false,earnedOn:null},{id:'consistent_week',earned:false,earnedOn:null}];
  await check('release capabilities are fixed, authenticated, scoped and do not depend on demo switches',async()=>{
    const policy=await rpc(a,'hl_app_capabilities');
    assert.deepEqual(policy,{policyVersion:'ios-hk-health-points-v1',storefront:'HK',features:{healthActivity:true,points:true,platformBadges:true,walletConnection:false,nftPurchases:false,cryptoRewards:false,rewardedAds:false,inAppPurchases:false,demoRedemptions:false}});
    assert.deepEqual(await withDemoRedemptions(()=>rpc(a,'hl_app_capabilities')),policy);
    assert.deepEqual(await rpc(b,'hl_app_capabilities'),policy);
    for(const name of ['hl_badges','hl_app_capabilities','hl_release_rewards']) {
      await rejected(()=>rpc(a,name,[],{is_anonymous:true}),'UNAUTHENTICATED');
      await rejected(()=>rpc(randomUUID(),name),'ONBOARDING_REQUIRED');
      assert.equal((await admin.query('select has_function_privilege($1,$2,$3) allowed',['anon',`public.${name}()`,'execute'])).rows[0].allowed,false);
    }
    await rejected(()=>session(a,c=>c.query("update private.system_settings set demo_mode=true")),'permission denied');
  });
  await check('badge GET without cloud consent reads only existing awards and never posts or synthesizes activity',async()=>{
    const before=(await admin.query('select count(*)::int n from public.mission_instances where user_id=$1',[b])).rows[0].n;
    assert.deepEqual((await badges(b)).items,empty);assert.deepEqual((await badges(b)).items,empty);
    assert.equal(Date.parse((await badges(b)).evaluatedAt),Date.parse('2026-09-21T01:00:00Z'));
    assert.deepEqual((await rpc(b,'hl_ledger')).items,[]);
    assert.equal((await admin.query('select count(*)::int n from public.mission_instances where user_id=$1',[b])).rows[0].n,before);
    assert.equal((await admin.query('select count(*)::int n from public.activity_submissions where user_id=$1',[b])).rows[0].n,0);
  });
  await check('badges require posted canonical daily and weekly entitlements, never a sync or another account award',async()=>{
    for(const day of ['2026-09-21','2026-09-22','2026-09-23']) {
      await clock(`${day}T01:00:00Z`);const result=await sync(a,3000,1,day);
      if(day==='2026-09-21') assert.deepEqual((await badges(a)).items,empty);
      await rpc(a,'hl_claim',[result.instanceId,randomUUID()]);
      assert.equal((await sync(a,0,2,day)).status,'pending_review');
    }
    assert.deepEqual((await badges(a)).items,[{id:'first_steps',earned:true,earnedOn:'2026-09-21'},{id:'consistent_week',earned:true,earnedOn:'2026-09-21'}]);
    assert.deepEqual((await badges(b)).items,empty);
    const ledger=await rpc(a,'hl_ledger');await badges(a);assert.deepEqual(await rpc(a,'hl_ledger'),ledger);
  });
  await check('badges remain readable when optional cloud consent is withdrawn',async()=>{
    const earned=(await badges(a)).items;await rpc(a,'hl_set_consents',[true,true,false,false,'2026-09-18']);
    assert.deepEqual((await badges(a)).items,earned);
    await rejected(()=>sync(a,5000,2,'2026-09-23'),'CONSENT_REQUIRED');
    await rpc(a,'hl_set_consents',[true,true,true,false,'2026-09-18']);
  });
  await check('two-person compensating correction recomputes earliest badge date and retracts the weekly badge',async()=>{
    const operator=await user(),reviewer=await user();
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'operator'),($2,'reviewer')",[operator,reviewer]);
    for(const day of ['2026-09-21','2026-09-22','2026-09-23']) {
      // Older summaries use the retained correction review path; no new auto award.
      const appeal=await rpc(a,'hl_create_appeal',[day,'Synthetic fixture: review the retained downward activity correction.']);
      const proposal=await rpc(operator,'hl_propose_appeal',[appeal.id,2,'Synthetic fixture: propose the existing pending revision.',randomUUID()],{aal:'aal2'});
      await rpc(reviewer,'hl_decide_appeal',[proposal.id,'approve','Synthetic fixture: independent reviewer confirms the correction.',randomUUID()],{aal:'aal2'});
      const actual=await badges(a);
      assert.deepEqual(item(actual,'consistent_week'),{id:'consistent_week',earned:false,earnedOn:null});
      if(day==='2026-09-21') assert.deepEqual(item(actual,'first_steps'),{id:'first_steps',earned:true,earnedOn:'2026-09-22'});
    }
    assert.deepEqual((await badges(a)).items,empty);
    assert.equal((await rpc(a,'hl_ledger')).items.some(i=>i.kind==='weekly_correction'),true);
  });
  await check('real core blocks all fresh demo spend directly in SQL and preserves history/refunds/replays',async()=>{
    const c=await user(),m=await sync(c,7000,1,'2026-09-23');await rpc(c,'hl_claim',[m.instanceId,randomUUID()]);
    const reward=randomUUID(),key=randomUUID();await admin.query("insert into public.reward_catalog(id,title_key,points_cost,stock) values($1,'rewards.demo',10,1)",[reward]);
    assert.deepEqual(await rpc(c,'hl_rewards'),{items:[]});assert.deepEqual(await rpc(c,'hl_release_rewards'),{items:[]});
    for(const method of ['hl_redeem','hl_reconcile_redemption']) await rejected(()=>rpc(c,method,[reward,key]),'NOT_SUPPORTED');
    assert.equal((await rpc(c,'hl_points_summary')).balance,30);
    const receipt=await withDemoRedemptions(()=>rpc(c,'hl_redeem',[reward,key]));
    await withDemoRedemptions(async()=>{
      assert.deepEqual(await rpc(c,'hl_release_rewards'),{items:[]});
      await rejected(()=>rpc(c,'hl_reconcile_redemption',[reward,randomUUID()]),'NOT_SUPPORTED');
    });
    await rpc(c,'hl_set_consents',[true,true,false,false,'2026-09-18']);
    assert.deepEqual(await rpc(c,'hl_redeem',[reward,key]),receipt);assert.deepEqual(await rpc(c,'hl_reconcile_redemption',[reward,key]),receipt);
    await rejected(()=>rpc(c,'hl_reconcile_redemption',[randomUUID(),key]),'IDEMPOTENCY_CONFLICT');
    await rejected(()=>rpc(b,'hl_reconcile_redemption',[reward,key]),'NOT_SUPPORTED');
    await Promise.all(Array.from({length:10},()=>rpc(c,'hl_cancel_redemption',[receipt.id])));
    assert.equal((await rpc(c,'hl_points_summary')).balance,30);
    assert.equal((await rpc(c,'hl_reconcile_redemption',[reward,key])).status,'cancelled');
    assert.equal((await rpc(c,'hl_ledger')).items.filter(i=>i.kind==='refund').length,1);
  });
  await check('deletion immediately blocks capabilities and achievements and purge removes qualifying records',async()=>{
    const c=await user(),m=await sync(c,3000,1,'2026-09-23');await rpc(c,'hl_claim',[m.instanceId,randomUUID()]);
    const deletion=await rpc(c,'hl_request_deletion',[],{amr:[{method:'otp',timestamp:Date.parse('2026-09-23T01:00:00Z')/1000}]});
    for(const name of ['hl_app_capabilities','hl_badges','hl_release_rewards']) await rejected(()=>rpc(c,name),'ACCOUNT_INACTIVE');
    await admin.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);
    await admin.query('select public.hl_purge_deletion($1)',[deletion.jobId]);
    assert.equal((await admin.query('select count(*)::int n from public.mission_instances where user_id=$1',[c])).rows[0].n,0);
    await rejected(()=>badges(c),'ACCOUNT_INACTIVE');
  });
}
