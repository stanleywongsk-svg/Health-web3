/** Real PostgreSQL regressions. Auth claims are injected by the owner-only fixture. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';

export async function runAppealAdjustmentTests({ admin, pool, rpc, session, user, clock, sync, check, rejected, withDemoRedemptions }) {
  const demoRedeem=(id,args)=>withDemoRedemptions(()=>rpc(id,'hl_redeem',args));
  const mfa = { aal:'aal2' };
  const reason = 'Existing pending revision reviewed against the submitted summary.';
  const decisionReason = 'A second reviewer confirms the bounded correction and its effects.';
  const decision = (reviewer, proposal, choice='approve', key=randomUUID(), why=decisionReason) =>
    rpc(reviewer,'hl_decide_appeal',[proposal.id,choice,why,key],mfa);
  const propose = (operator, appeal, revision=2, key=randomUUID(), why=reason) =>
    rpc(operator,'hl_propose_appeal',[appeal.id,revision,why,key],mfa);
  async function actors() {
    const operator=await user(), reviewer=await user();
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'operator'),($2,'reviewer')",[operator,reviewer]);
    return {operator,reviewer};
  }
  async function pending({claimed=true,steps=0}={}) {
    await clock('2026-09-14T09:00:00Z');
    const subject=await user();
    const summary=await sync(subject,7000);
    if(claimed) await rpc(subject,'hl_claim',[summary.instanceId,randomUUID()]);
    const submission=await sync(subject,steps,2);
    assert.equal(submission.status,'pending_review');
    const appeal=await rpc(subject,'hl_create_appeal',['2026-09-14','Please review this existing daily revision.']);
    return {subject,summary,appeal};
  }
  async function week() {
    const subject=await user(); let summary;
    for(const day of ['2026-09-14','2026-09-15','2026-09-16']) {
      await clock(`${day}T09:00:00Z`); summary=await sync(subject,7000,1,day);
      await rpc(subject,'hl_claim',[summary.instanceId,randomUUID()]);
    }
    assert.equal((await rpc(subject,'hl_points_summary')).balance,110);
    await sync(subject,0,2,'2026-09-16');
    const appeal=await rpc(subject,'hl_create_appeal',['2026-09-16','Please review the pending Wednesday correction.']);
    return {subject,summary,appeal};
  }
  async function service(name,args=[]) {
    const c=await pool.connect();
    try {
      await c.query('begin'); await c.query('set local role service_role');
      await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'service_role'})]);
      const result=(await c.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) as result`,args)).rows[0].result;
      await c.query('commit'); return result;
    } catch(error) { await c.query('rollback'); throw error; } finally { c.release(); }
  }
  async function claimTotals(subject) {
    return (await admin.query(`select m.id,m.awarded_points,coalesce(sum(l.points),0)::integer posted
      from public.mission_instances m join public.profiles p on p.id=m.user_id
      left join public.point_ledger l on l.account_key=p.account_key and l.instance_id=m.id
      where m.user_id=$1 group by m.id`,[subject])).rows;
  }

  await check('appeal queue requires server role and AAL2; user list isolates subjects',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), outsider=await user();
    await rejected(()=>rpc(outsider,'hl_admin_appeals',[],{...mfa,user_metadata:{role:'operator'}}),'FORBIDDEN');
    await rejected(()=>rpc(operator,'hl_admin_appeals'),'FORBIDDEN');
    await rejected(()=>rpc(operator,'hl_propose_appeal',[f.appeal.id,2,reason,randomUUID()]),'FORBIDDEN');
    await rejected(()=>propose(reviewer,f.appeal),'FORBIDDEN');
    const own=await rpc(f.subject,'hl_appeals'); assert.equal(own.items.length,1);
    assert.equal(own.items[0].sequenceId.match(/^\d+$/)[0],own.items[0].sequenceId);
    assert.equal('subjectId' in own.items[0],false); assert.deepEqual(own.items[0].proposals,[]);
    assert.equal((await rpc(outsider,'hl_appeals')).items.length,0);
    const queue=await rpc(operator,'hl_admin_appeals',[],mfa), item=queue.items.find(a=>a.id===f.appeal.id);
    assert.equal(item.subjectId,f.subject); assert.deepEqual(item.canonicalSummary,{eligibleSteps:7000,revision:1});
    assert.deepEqual(item.pendingSubmissions.map(s=>[s.revision,s.eligibleSteps,s.reason]),[[2,0,'downward_revision']]);
    assert.equal('sourcePinToken' in item.pendingSubmissions[0],false);
    await rejected(()=>session(operator,c=>c.query('select * from private.appeal_adjustments')),'permission denied');
    await rejected(()=>session(operator,c=>c.query('select private.require_review_role()')),'permission denied');
    await rejected(()=>rpc(f.subject,'hl_appeals',[101,null]),'INVALID_INPUT');
  });
  await check('proposal validates retained pending revision, mandatory reason, replay and conflict',async()=> {
    const f=await pending(), {operator}=await actors(), key=randomUUID();
    await rejected(()=>propose(operator,f.appeal,1),'SUBMISSION_NOT_REVIEWABLE');
    await rejected(()=>propose(operator,f.appeal,3),'SUBMISSION_NOT_REVIEWABLE');
    await rejected(()=>propose(operator,f.appeal,2,randomUUID(),'    '),'INVALID_INPUT');
    const proposal=await propose(operator,f.appeal,2,key);
    assert.deepEqual(await propose(operator,f.appeal,2,key),proposal);
    await rejected(()=>propose(operator,f.appeal,2,key,`${reason} Changed.`),'IDEMPOTENCY_CONFLICT');
    await rejected(()=>propose(operator,f.appeal,3,key),'IDEMPOTENCY_CONFLICT');
    assert.equal((await rpc(f.subject,'hl_appeals')).items[0].proposals[0].status,'pending');
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'operator')",[f.subject]);
    await rejected(()=>propose(f.subject,f.appeal),'SELF_REVIEW');
  });
  await check('a distinct AAL2 reviewer is mandatory; reject is audited without changing balances',async()=> {
    const f=await pending(), {operator,reviewer}=await actors();
    const proposal=await propose(operator,f.appeal), key=randomUUID();
    await rejected(()=>rpc(reviewer,'hl_decide_appeal',[proposal.id,'approve',decisionReason,key]),'FORBIDDEN');
    await rejected(()=>decision(operator,proposal),'FORBIDDEN');
    await admin.query("update private.admin_roles set role='reviewer' where user_id=$1",[operator]);
    await rejected(()=>decision(operator,proposal),'SELF_REVIEW');
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'reviewer')",[f.subject]);
    await rejected(()=>decision(f.subject,proposal),'SELF_REVIEW');
    await rejected(()=>decision(reviewer,proposal,'reject',key,''),'INVALID_INPUT');
    const result=await decision(reviewer,proposal,'reject',key);
    assert.equal(result.status,'rejected'); assert.equal(result.balance,30); assert.equal(result.addedPoints,0);
    assert.deepEqual(await decision(reviewer,proposal,'reject',key),result);
    await rejected(()=>decision(reviewer,proposal,'approve',key),'IDEMPOTENCY_CONFLICT');
    await rejected(()=>decision(reviewer,proposal,'reject',key,`${decisionReason} Changed.`),'IDEMPOTENCY_CONFLICT');
    await rejected(()=>decision(reviewer,proposal),'PROPOSAL_DECIDED');
    const record=(await rpc(f.subject,'hl_appeals')).items[0]; assert.equal(record.status,'open');
    assert.equal(record.proposals[0].decisionReason,decisionReason);
    const audit=(await admin.query('select * from private.admin_audit where adjustment_id=$1 order by id',[proposal.id])).rows;
    assert.equal(audit.length,2); assert.equal(audit[1].actor_id,reviewer);
    assert.equal(audit[1].reason_digest,createHash('sha256').update(decisionReason).digest('hex'));
    assert.equal(audit[1].reason.includes(decisionReason),false);
    await rejected(()=>admin.query('update private.admin_audit set reason=$1 where adjustment_id=$2',['changed',proposal.id]),'IMMUTABLE_RECORD');
    await rejected(()=>admin.query('update private.appeal_adjustments set proposal_reason=$1 where id=$2',['different reason entirely',proposal.id]),'IMMUTABLE_RECORD');
  });
  await check('downward day and week correction preserves spent history and signed negative balance',async()=> {
    await clock('2026-09-14T09:00:00Z'); const {operator,reviewer}=await actors(), f=await week();
    const reward=randomUUID(), redeemKey=randomUUID();
    await admin.query("insert into public.reward_catalog(id,title_key,points_cost,stock) values($1,'rewards.demo',100,2)",[reward]);
    const redemption=await demoRedeem(f.subject,[reward,redeemKey]);
    const proposal=await propose(operator,f.appeal), key=randomUUID();
    const result=await decision(reviewer,proposal,'approve',key);
    assert.equal(result.dailyDelta,-30); assert.equal(result.weeklyDelta,-20); assert.equal(result.balance,-40); assert.equal(result.availablePoints,0);
    assert.deepEqual(await decision(reviewer,proposal,'approve',key),result);
    const totals=await rpc(f.subject,'hl_points_summary');
    assert.deepEqual([totals.balance,totals.availablePoints,totals.earnedPoints,totals.spentPoints,totals.correctionPoints,totals.reversedPoints],[-40,0,110,100,-50,0]);
    await rejected(()=>demoRedeem(f.subject,[reward,randomUUID()]),'INSUFFICIENT_POINTS');
    assert.deepEqual(await demoRedeem(f.subject,[reward,redeemKey]),redemption);
    const ledger=(await rpc(f.subject,'hl_ledger')).items, corrected=ledger.filter(l=>l.adjustmentId===proposal.id);
    assert.equal(corrected.length,2); assert.ok(corrected.every(l=>l.relatedEntryId!==null));
    assert.equal(ledger.reduce((sum,l)=>sum+l.points,0),-40);
    assert.equal((await rpc(f.subject,'hl_appeals')).items[0].status,'resolved');
    assert.equal((await rpc(f.subject,'hl_health_summary')).items[0].revision,2);
    assert.equal((await rpc(f.subject,'hl_health_summary')).items[0].eligibleSteps,0);
    assert.ok((await claimTotals(f.subject)).every(row=>row.awarded_points===row.posted));
    const exported=await rpc(f.subject,'hl_export'); assert.equal(exported.appealAdjustments[0].id,proposal.id);
    assert.equal(exported.appealAdjustments[0].decisionReason,decisionReason); assert.equal('baseline' in exported.appealAdjustments[0],false);
    assert.equal('reviewerId' in exported.appealAdjustments[0],false);
    await rejected(()=>admin.query('delete from public.point_ledger where adjustment_id=$1',[proposal.id]),'IMMUTABLE_RECORD');
    // A second reviewed existing pending revision can restore previously posted totals.
    await sync(f.subject,40000,3,'2026-09-16');
    const appeal=await rpc(f.subject,'hl_create_appeal',['2026-09-16','Please review the existing restoration revision.']);
    const restore=await propose(operator,appeal,3), restored=await decision(reviewer,restore);
    assert.equal(restored.dailyDelta,30); assert.equal(restored.weeklyDelta,20); assert.equal(restored.balance,10);
    assert.ok((await claimTotals(f.subject)).every(row=>row.awarded_points===row.posted));
    await rejected(()=>propose(operator,f.appeal,2),'APPEAL_CLOSED');
  });
  await check('ordinary accepted sync and claim can restore repeated day and week entitlements once',async()=> {
    await clock('2026-09-14T09:00:00Z'); const {operator,reviewer}=await actors(), f=await week();
    const q=await propose(operator,f.appeal); await decision(reviewer,q);
    assert.equal((await sync(f.subject,7000,3,'2026-09-16')).status,'accepted');
    const claims=await Promise.all(Array.from({length:20},()=>rpc(f.subject,'hl_claim',[f.summary.instanceId,randomUUID()])));
    assert.equal(claims.reduce((sum,r)=>sum+r.addedPoints,0),50);
    assert.equal((await rpc(f.subject,'hl_points_summary')).balance,110);
    assert.ok((await claimTotals(f.subject)).every(row=>row.awarded_points===row.posted));
  });
  await check('first positive reviewed summary pins source and can reconcile after normal cutoff',async()=> {
    await clock('2026-09-14T09:00:00Z'); const {operator,reviewer}=await actors(), subject=await user();
    const pendingSummary=await sync(subject,40000);
    const appeal=await rpc(subject,'hl_create_appeal',['2026-09-14','Please review my first excessive pending summary.']);
    const proposal=await propose(operator,appeal,1);
    await clock('2026-09-15T04:00:00Z');
    await rejected(()=>sync(subject,50000,2,'2026-09-14'),'CUTOFF_PASSED');
    const result=await decision(reviewer,proposal); assert.equal(result.dailyDelta,30);
    await rejected(()=>rpc(subject,'hl_claim',[pendingSummary.instanceId,randomUUID()]),'CUTOFF_PASSED');
    const ledger=(await rpc(subject,'hl_ledger')).items;
    assert.equal(ledger.length,1); assert.equal(ledger[0].relatedEntryId,null);
    const mission=(await admin.query('select source_category,source_pin_token from public.mission_instances where id=$1',[pendingSummary.instanceId])).rows[0];
    assert.equal(mission.source_category,'apple_phone'); assert.ok(mission.source_pin_token);
    // Retry remains the exact original transport receipt; status read shows resolution.
    assert.deepEqual(await sync(subject,40000,1,'2026-09-14'),pendingSummary);
    assert.equal((await rpc(subject,'hl_appeals')).items[0].proposals[0].status,'approved');
  });
  await check('newer submissions or changed week/claim counters make proposals stale',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal);
    await sync(f.subject,1000,3);
    await rejected(()=>decision(reviewer,q),'STALE_PROPOSAL');
    await rejected(()=>propose(operator,f.appeal,2),'SUBMISSION_NOT_REVIEWABLE');
    assert.equal((await decision(reviewer,q,'reject')).status,'rejected');
    const f2=await pending({claimed:false}), q2=await propose(operator,f2.appeal);
    await rpc(f2.subject,'hl_claim',[f2.summary.instanceId,randomUUID()]);
    await rejected(()=>decision(reviewer,q2),'STALE_PROPOSAL');
    const q3=await propose(operator,f2.appeal);
    await clock('2026-09-15T09:00:00Z'); await sync(f2.subject,3000,1,'2026-09-15');
    await rejected(()=>decision(reviewer,q3),'STALE_PROPOSAL');
    assert.equal((await rpc(f2.subject,'hl_points_summary')).balance,30);
  });
  await check('paused rewards and withdrawn consent prohibit approvals without altering history',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal);
    await rpc(operator,'hl_admin_pause',[true,'Incident pause for correction test.'],mfa);
    await rejected(()=>decision(reviewer,q),'REWARDS_PAUSED');
    assert.equal((await decision(reviewer,q,'reject')).addedPoints,0);
    const replacement=await propose(operator,f.appeal);
    await rpc(operator,'hl_admin_pause',[false,'Incident resolved for correction test.'],mfa);
    await rpc(f.subject,'hl_set_consents',[true,true,false,false,'2026-09-18']);
    await rejected(()=>decision(reviewer,replacement),'CONSENT_REQUIRED');
    await rejected(()=>propose(operator,f.appeal),'CONSENT_REQUIRED');
    assert.equal((await rpc(f.subject,'hl_points_summary')).balance,30);
    assert.equal((await rpc(operator,'hl_admin_appeals',[],mfa)).items.some(item=>item.id===f.appeal.id),false);
  });
  await check('100 identical approval retries produce one decision and one correction',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal), key=randomUUID();
    const results=await Promise.all(Array.from({length:100},()=>decision(reviewer,q,'approve',key)));
    assert.ok(results.every(r=>JSON.stringify(r)===JSON.stringify(results[0])));
    assert.equal(results[0].balance,0);
    assert.equal((await admin.query('select count(*)::integer n from public.point_ledger where adjustment_id=$1',[q.id])).rows[0].n,1);
    assert.equal((await admin.query("select count(*)::integer n from private.admin_audit where adjustment_id=$1 and action='approve_appeal'",[q.id])).rows[0].n,1);
    await rejected(()=>decision(reviewer,q,'approve',randomUUID()),'PROPOSAL_DECIDED');
  });
  await check('independent reviewers, simultaneous claim and approval remain serialized',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), second=await user();
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'reviewer')",[second]);
    const q=await propose(operator,f.appeal);
    const results=await Promise.allSettled([decision(reviewer,q),decision(second,q),...Array.from({length:20},()=>rpc(f.subject,'hl_claim',[f.summary.instanceId,randomUUID()]))]);
    assert.equal(results.slice(0,2).filter(r=>r.status==='fulfilled').length,1);
    assert.equal(results.slice(0,2).filter(r=>r.status==='rejected'&&r.reason.message==='PROPOSAL_DECIDED').length,1);
    assert.ok(results.slice(2).every(r=>r.status==='fulfilled'&&r.value.addedPoints===0));
    assert.equal((await rpc(f.subject,'hl_points_summary')).balance,0);
    assert.ok((await claimTotals(f.subject)).every(row=>row.awarded_points===row.posted));
  });
  await check('redemption racing correction spends at most the pre-correction amount atomically',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal), reward=randomUUID();
    await admin.query("insert into public.reward_catalog(id,title_key,points_cost,stock) values($1,'rewards.demo',30,1)",[reward]);
    const results=await Promise.allSettled([decision(reviewer,q),demoRedeem(f.subject,[reward,randomUUID()])]);
    assert.equal(results[0].status,'fulfilled');
    if(results[1].status==='rejected') assert.equal(results[1].reason.message,'INSUFFICIENT_POINTS');
    const spent=results[1].status==='fulfilled';
    const total=await rpc(f.subject,'hl_points_summary'); assert.equal(total.balance,spent?-30:0); assert.equal(total.availablePoints,0);
    assert.equal((await admin.query('select stock from public.reward_catalog where id=$1',[reward])).rows[0].stock,spent?0:1);
    await rejected(()=>demoRedeem(f.subject,[reward,randomUUID()]),spent?'OUT_OF_STOCK':'INSUFFICIENT_POINTS');
  });
  await check('failed weekly posting rolls back daily posting, accepted revision, audit and decision',async()=> {
    await clock('2026-09-14T09:00:00Z'); const {operator,reviewer}=await actors(), f=await week(), q=await propose(operator,f.appeal), key=randomUUID();
    await admin.query("create function private.fail_correction_test() returns trigger language plpgsql as $$ begin if new.kind='weekly_correction' then raise exception 'FORCED_CORRECTION_FAILURE'; end if; return new; end $$; create trigger fail_correction_test before insert on public.point_ledger for each row execute function private.fail_correction_test();");
    try { await rejected(()=>decision(reviewer,q,'approve',key),'FORCED_CORRECTION_FAILURE'); }
    finally { await admin.query('drop trigger fail_correction_test on public.point_ledger; drop function private.fail_correction_test()'); }
    assert.equal((await rpc(f.subject,'hl_points_summary')).balance,110);
    assert.equal((await rpc(f.subject,'hl_health_summary')).items[0].revision,1);
    assert.equal((await rpc(f.subject,'hl_appeals')).items[0].proposals[0].status,'pending');
    assert.equal((await admin.query('select count(*)::integer n from public.point_ledger where adjustment_id=$1',[q.id])).rows[0].n,0);
    assert.equal((await admin.query('select count(*)::integer n from private.admin_audit where adjustment_id=$1',[q.id])).rows[0].n,1);
    assert.ok((await claimTotals(f.subject)).every(row=>row.awarded_points===row.posted));
    assert.equal((await decision(reviewer,q,'approve',key)).addedPoints,-50);
  });
  await check('withdrawal still permits exact redemption recovery and refund, but no new spend',async()=> {
    const f=await pending(), reward=randomUUID(), key=randomUUID();
    await admin.query("insert into public.reward_catalog(id,title_key,points_cost,stock) values($1,'rewards.demo',10,2)",[reward]);
    const receipt=await demoRedeem(f.subject,[reward,key]);
    await rpc(f.subject,'hl_set_consents',[true,true,false,false,'2026-09-18']);
    assert.deepEqual(await demoRedeem(f.subject,[reward,key]),receipt);
    await rejected(()=>demoRedeem(f.subject,[reward,randomUUID()]),'CONSENT_REQUIRED');
    await rpc(f.subject,'hl_cancel_redemption',[receipt.id]);
    assert.equal((await rpc(f.subject,'hl_points_summary')).balance,30);
    assert.equal((await demoRedeem(f.subject,[reward,key])).status,'cancelled');
  });
  await check('deletion racing approval removes review data; old subject and admin JWTs stay blocked',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal), key=randomUUID();
    const results=await Promise.allSettled([decision(reviewer,q,'approve',key),rpc(f.subject,'hl_request_deletion')]);
    assert.equal(results[1].status,'fulfilled');
    if(results[0].status==='rejected') assert.equal(results[0].reason.message,'ACCOUNT_INACTIVE');
    await rejected(()=>decision(reviewer,q,'approve',key),'ACCOUNT_INACTIVE');
    const job=results[1].value.jobId;
    const ledgerCount=(await admin.query('select count(*)::integer n from public.point_ledger')).rows[0].n;
    await service('hl_purge_deletion',[job]); await service('hl_complete_deletion',[job]);
    assert.equal((await admin.query('select count(*)::integer n from private.appeal_adjustments where user_id=$1',[f.subject])).rows[0].n,0);
    assert.equal((await admin.query('select count(*)::integer n from public.appeals where user_id=$1',[f.subject])).rows[0].n,0);
    assert.equal((await admin.query('select count(*)::integer n from public.point_ledger')).rows[0].n,ledgerCount);
    await rejected(()=>rpc(f.subject,'hl_appeals'),'ACCOUNT_INACTIVE');
    await rejected(()=>rpc(f.subject,'hl_set_consents',[true,true,true,false,'2026-09-18']),'ACCOUNT_INACTIVE');
    await rejected(()=>decision(reviewer,q,'approve',key),'NOT_FOUND');
    // Even a correctly signed AAL2 claim cannot revive a deleted server operator.
    const adminJob=await rpc(operator,'hl_request_deletion');
    await rejected(()=>rpc(operator,'hl_admin_appeals',[],mfa),'ACCOUNT_INACTIVE');
    await service('hl_purge_deletion',[adminJob.jobId]);
    await rejected(()=>rpc(operator,'hl_admin_appeals',[],mfa),'ACCOUNT_INACTIVE');
  });
  await check('opposite admin/subject pairs do not deadlock ordered profile locks',async()=> {
    const left=await pending(), right=await pending();
    await admin.query("insert into private.admin_roles(user_id,role) values($1,'operator'),($2,'operator')",[left.subject,right.subject]);
    const results=await Promise.all([propose(left.subject,right.appeal),propose(right.subject,left.appeal)]);
    assert.equal(results.length,2); assert.notEqual(results[0].id,results[1].id);
  });
  await check('review decision keys bind the full request and roles are checked again on replay',async()=> {
    const left=await pending(), right=await pending(), {operator,reviewer}=await actors();
    const a=await propose(operator,left.appeal), b=await propose(operator,right.appeal), key=randomUUID();
    await decision(reviewer,a,'reject',key);
    await rejected(()=>decision(reviewer,b,'reject',key),'IDEMPOTENCY_CONFLICT');
    await admin.query('delete from private.admin_roles where user_id=$1',[reviewer]);
    await rejected(()=>decision(reviewer,a,'reject',key),'FORBIDDEN');
    await rejected(()=>decision(reviewer,b),'FORBIDDEN');
  });
  await check('appeal and admin queue cursors remain stable when timestamps are identical',async()=> {
    const f=await pending(), {operator}=await actors();
    for(let n=0;n<3;n++) await rpc(f.subject,'hl_create_appeal',['2026-09-14',`Additional bounded test appeal number ${n}`]);
    const first=await rpc(f.subject,'hl_appeals',[2,null]), second=await rpc(f.subject,'hl_appeals',[100,first.nextCursor]);
    assert.equal(new Set([...first.items,...second.items].map(a=>a.id)).size,4);
    const page=await rpc(operator,'hl_admin_appeals',[2,null],mfa);
    const following=await rpc(operator,'hl_admin_appeals',[2,page.nextCursor],mfa);
    assert.equal(new Set([...page.items,...following.items].map(a=>a.id)).size,4);
    assert.ok(following.items.every(a=>BigInt(a.sequenceId)<BigInt(page.nextCursor)));
  });
  await check('approval of latest pending revision resolves superseded risk flags',async()=> {
    const f=await pending(), {operator,reviewer}=await actors();
    await sync(f.subject,1000,3);
    const proposal=await propose(operator,f.appeal,3);
    await decision(reviewer,proposal);
    assert.equal((await rpc(f.subject,'hl_points_summary')).pendingEvaluations,0);
    assert.equal((await rpc(f.subject,'hl_health_summary')).items[0].revision,3);
  });
  await check('partially expired dependent week cannot be reviewed or retained in a proposal snapshot',async()=> {
    await clock('2026-09-14T09:00:00Z'); const {operator,reviewer}=await actors(), f=await week(), q=await propose(operator,f.appeal);
    await admin.query('update private.system_settings set summary_retention_days=1');
    try {
      // Wednesday is retained, but the Monday in its review snapshot is not.
      await rejected(()=>decision(reviewer,q),'SUBMISSION_NOT_REVIEWABLE');
      await rejected(()=>propose(operator,f.appeal),'SUBMISSION_NOT_REVIEWABLE');
      await service('hl_prune_summaries');
      assert.equal((await admin.query('select count(*)::integer n from private.appeal_adjustments where id=$1',[q.id])).rows[0].n,0);
      const own=await rpc(f.subject,'hl_appeals'); assert.equal(own.items.length,1); assert.deepEqual(own.items[0].proposals,[]);
      assert.equal((await rpc(f.subject,'hl_health_summary')).items[0].taskDate,'2026-09-16');
    } finally { await admin.query('update private.system_settings set summary_retention_days=90'); }
  });
  await check('retention removes review free text and evidence without erasing accounting or audit',async()=> {
    const f=await pending(), {operator,reviewer}=await actors(), q=await propose(operator,f.appeal);
    await decision(reviewer,q);
    const before=(await admin.query('select count(*)::integer n from public.point_ledger where adjustment_id=$1',[q.id])).rows[0].n;
    await admin.query('update private.system_settings set summary_retention_days=1');
    try {
      await clock('2026-09-17T09:00:00Z');
      await service('hl_prune_summaries');
      assert.equal((await admin.query('select count(*)::integer n from private.appeal_adjustments where id=$1',[q.id])).rows[0].n,0);
      assert.equal((await rpc(f.subject,'hl_appeals')).items.length,0);
      assert.equal((await admin.query('select count(*)::integer n from public.activity_submissions where user_id=$1',[f.subject])).rows[0].n,0);
      assert.equal((await admin.query('select count(*)::integer n from public.point_ledger where adjustment_id=$1',[q.id])).rows[0].n,before);
      assert.equal((await admin.query('select count(*)::integer n from private.admin_audit where adjustment_id=$1',[q.id])).rows[0].n,2);
    } finally { await admin.query('update private.system_settings set summary_retention_days=90'); }
  });
}
