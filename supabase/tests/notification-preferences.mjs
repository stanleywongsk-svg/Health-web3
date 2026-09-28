/** Real PostgreSQL preference tests; auth is the explicitly synthetic JWT fixture. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runNotificationPreferenceTests({ admin,pool,rpc,session,user,clock,sync,check,rejected }) {
  const defaults={enabled:false,reminderTime:'19:00',quietStart:'22:00',quietEnd:'08:00',timezone:'Asia/Hong_Kong',revision:0,updatedAt:null};
  const set=(id,changes={},expectedRevision=0)=> {
    const input={...defaults,...changes};
    return rpc(id,'hl_set_notification_preferences',[input.enabled,input.reminderTime,input.quietStart,input.quietEnd,input.timezone,expectedRevision]);
  };
  const get=id=>rpc(id,'hl_notification_preferences');
  async function service(name,args=[]) {
    const c=await pool.connect();
    try {
      await c.query('begin'); await c.query('set local role service_role');
      await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({role:'service_role'})]);
      const result=(await c.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result;
      await c.query('commit'); return result;
    } catch(error) { await c.query('rollback'); throw error; } finally { c.release(); }
  }
  await clock('2026-09-14T09:00:00Z');
  await check('reminder default is disabled, unpersisted and independent of optional consents',async()=> {
    const id=await user(false);
    await rpc(id,'hl_set_consents',[true,false,false,false,'2026-09-18']);
    assert.deepEqual(await get(id),defaults);
    assert.deepEqual(await set(id),defaults);
    assert.equal((await admin.query('select count(*)::integer n from public.notification_preferences where user_id=$1',[id])).rows[0].n,0);
    const profile=(await rpc(id,'hl_consents')).profile;
    const consentCount=(await admin.query('select count(*)::integer n from public.consent_events where user_id=$1',[id])).rows[0].n;
    const enabled=await set(id,{enabled:true});
    assert.equal(enabled.enabled,true); assert.equal(enabled.revision,1);
    assert.equal(Date.parse(enabled.updatedAt),Date.parse('2026-09-14T09:00:00Z'));
    assert.deepEqual((await rpc(id,'hl_consents')).profile,profile);
    assert.equal((await admin.query('select count(*)::integer n from public.consent_events where user_id=$1',[id])).rows[0].n,consentCount);
    assert.equal((await rpc(id,'hl_points_summary')).balance,0);
    assert.equal((await admin.query('select count(*)::integer n from public.mission_instances where user_id=$1',[id])).rows[0].n,0);
  });
  await check('reminder RPCs require an active onboarded account and reject anonymous identity',async()=> {
    const missing=randomUUID();
    await rejected(()=>get(missing),'ONBOARDING_REQUIRED');
    await rejected(()=>set(missing),'ONBOARDING_REQUIRED');
    const id=await user();
    await rejected(()=>rpc(id,'hl_notification_preferences',[],{is_anonymous:true}),'UNAUTHENTICATED');
    const c=await pool.connect();
    try {
      await c.query('begin'); await c.query('set local role anon');
      await assert.rejects(()=>c.query('select public.hl_notification_preferences()'),e=>e.code==='42501');
      await c.query('rollback');
    } finally { c.release(); }
  });
  await check('reminder time input rejects noncanonical clocks, invalid bounds and timezone',async()=> {
    const id=await user();
    for(const invalid of ['24:00','23:60','9:00','09:0','09:00:00',' 09:00','09:00 ','09:00\n','09：00','00:60','-1:00','ab:cd','',null]) {
      for(const field of ['reminderTime','quietStart','quietEnd']) await rejected(()=>set(id,{[field]:invalid}),'INVALID_INPUT');
    }
    for(const timezone of ['UTC','Asia/Tokyo','asia/hong_kong','Asia/Hong_Kong ',null]) await rejected(()=>set(id,{timezone}),'INVALID_INPUT');
    await rejected(()=>set(id,{enabled:null}),'INVALID_INPUT');
    await rejected(()=>set(id,{},-1),'INVALID_INPUT');
    await rejected(()=>set(id,{},null),'INVALID_INPUT');
    await rejected(()=>set(id,{quietStart:'08:00',quietEnd:'08:00'}),'INVALID_INPUT');
    assert.deepEqual(await get(id),defaults);
    assert.equal((await admin.query("select count(*)::integer n from private.rate_windows where user_id=$1 and operation='notification_preferences'",[id])).rows[0].n,0);
  });
  await check('overnight and daytime quiet windows use inclusive start and exclusive end',async()=> {
    for(const [quietStart,quietEnd,cases] of [
      ['22:00','08:00',[['21:59',true],['22:00',false],['23:59',false],['00:00',false],['07:59',false],['08:00',true]]],
      ['08:00','22:00',[['07:59',true],['08:00',false],['21:59',false],['22:00',true],['23:59',true],['00:00',true]]],
    ]) {
      for(const [reminderTime,allowed] of cases) {
        const id=await user();
        if(allowed) assert.equal((await set(id,{enabled:true,reminderTime,quietStart,quietEnd})).enabled,true);
        else await rejected(()=>set(id,{enabled:true,reminderTime,quietStart,quietEnd}),'INVALID_INPUT');
      }
    }
    const id=await user(), disabled=await set(id,{reminderTime:'23:00'});
    assert.equal(disabled.enabled,false); assert.equal(disabled.revision,1);
    await rejected(()=>set(id,{enabled:true,reminderTime:'23:00'},1),'INVALID_INPUT');
  });
  await check('exact lost-response retry preserves revision and update time but stale changes conflict',async()=> {
    const id=await user(), saved=await set(id,{enabled:true});
    await clock('2026-09-14T09:00:30Z');
    assert.deepEqual(await set(id,{enabled:true},0),saved);
    assert.deepEqual(await set(id,{enabled:true},1),saved);
    await rejected(()=>set(id,{enabled:true},2),'PREFERENCES_CONFLICT');
    await rejected(()=>set(id,{enabled:true,reminderTime:'18:00'},0),'PREFERENCES_CONFLICT');
    const second=await set(id,{enabled:true,reminderTime:'18:00'},1);
    assert.equal(second.revision,2); assert.equal(Date.parse(second.updatedAt),Date.parse('2026-09-14T09:00:30Z'));
    await rejected(()=>set(id,{enabled:true},0),'PREFERENCES_CONFLICT');
    assert.equal((await admin.query("select hits from private.rate_windows where user_id=$1 and operation='notification_preferences'",[id])).rows[0].hits,2);
    await clock('2026-09-14T09:00:00Z');
  });
  await check('100 simultaneous identical preference writes create one revision and one rate hit',async()=> {
    const id=await user();
    const results=await Promise.all(Array.from({length:100},()=>set(id,{enabled:true})));
    assert.ok(results.every(result=>JSON.stringify(result)===JSON.stringify(results[0])));
    assert.equal(results[0].revision,1);
    assert.equal((await admin.query('select count(*)::integer n from public.notification_preferences where user_id=$1',[id])).rows[0].n,1);
    assert.equal((await admin.query("select hits from private.rate_windows where user_id=$1 and operation='notification_preferences'",[id])).rows[0].hits,1);
  });
  await check('competing changed states at one revision cannot silently overwrite each other',async()=> {
    const id=await user();
    const results=await Promise.allSettled([set(id,{enabled:true,reminderTime:'18:00'}),set(id,{enabled:true,reminderTime:'19:00'})]);
    assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
    assert.equal(results.filter(result=>result.status==='rejected'&&result.reason.message==='PREFERENCES_CONFLICT').length,1);
    assert.deepEqual(await get(id),results.find(result=>result.status==='fulfilled').value);
  });
  await check('disable bypasses an exhausted mutation budget and stale enable cannot reactivate',async()=> {
    const id=await user(); let current;
    for(let revision=0;revision<20;revision++) current=await set(id,{enabled:true,reminderTime:revision%2===0?'18:00':'19:00'},revision);
    assert.equal(current.revision,20);
    await rejected(()=>set(id,{enabled:true,reminderTime:'17:00'},20),'RATE_LIMITED');
    await rejected(()=>set(id,{enabled:false,reminderTime:'17:00'},20),'RATE_LIMITED');
    const disabled=await set(id,{enabled:false},20);
    assert.equal(disabled.enabled,false); assert.equal(disabled.revision,21);
    assert.deepEqual(await set(id,{enabled:false},20),disabled);
    await rejected(()=>set(id,{enabled:true},19),'PREFERENCES_CONFLICT');
    await rejected(()=>set(id,{enabled:true},21),'RATE_LIMITED');
    assert.equal((await get(id)).enabled,false);
    assert.equal((await admin.query("select hits from private.rate_windows where user_id=$1 and operation='notification_preferences'",[id])).rows[0].hits,20);
  });
  await check('stale disable cannot overwrite a newer schedule and current disable stays safe',async()=> {
    const id=await user(); await set(id,{enabled:true});
    await set(id,{enabled:true,reminderTime:'18:00'},1);
    await rejected(()=>set(id,{enabled:false},1),'PREFERENCES_CONFLICT');
    assert.equal((await get(id)).reminderTime,'18:00');
    const disabled=await set(id,{enabled:false,reminderTime:'18:00'},2);
    assert.equal(disabled.enabled,false); assert.equal(disabled.revision,3);
    await rejected(()=>set(id,{enabled:true,reminderTime:'18:00'},1),'PREFERENCES_CONFLICT');
  });
  await check('preference RLS isolates A/B and direct mutations are denied',async()=> {
    const a=await user(), b=await user();
    const aValue=await set(a,{enabled:true,reminderTime:'18:00'});
    const bValue=await set(b,{enabled:true,reminderTime:'19:00'});
    assert.deepEqual(await get(a),aValue); assert.deepEqual(await get(b),bValue);
    assert.equal((await session(b,c=>c.query('select user_id from public.notification_preferences where user_id=$1',[a]))).rows.length,0);
    const visible=(await session(b,c=>c.query('select user_id from public.notification_preferences'))).rows;
    assert.deepEqual(visible,[{user_id:b}]);
    await rejected(()=>session(a,c=>c.query('update public.notification_preferences set enabled=false where user_id=$1',[a])),'permission denied');
    await rejected(()=>session(a,c=>c.query('delete from public.notification_preferences where user_id=$1',[a])),'permission denied');
    await rejected(()=>session(a,c=>c.query('insert into public.notification_preferences(user_id,revision) values($1,1)',[b])),'permission denied');
    await rejected(()=>session(a,c=>c.query('select private.notification_preferences_json(p) from public.notification_preferences p')),'permission denied');
    assert.deepEqual(await get(a),aValue);
  });
  await check('failed preference write rolls back state, revision and rate budget atomically',async()=> {
    const id=await user();
    await admin.query("create function private.fail_preference_test() returns trigger language plpgsql as $$ begin raise exception 'FORCED_PREFERENCE_FAILURE'; end $$; create trigger fail_preference_test before insert or update on public.notification_preferences for each row execute function private.fail_preference_test();");
    try { await rejected(()=>set(id,{enabled:true}),'FORCED_PREFERENCE_FAILURE'); }
    finally { await admin.query('drop trigger fail_preference_test on public.notification_preferences; drop function private.fail_preference_test()'); }
    assert.deepEqual(await get(id),defaults);
    assert.equal((await admin.query("select count(*)::integer n from private.rate_windows where user_id=$1 and operation='notification_preferences'",[id])).rows[0].n,0);
    assert.equal((await set(id,{enabled:true})).revision,1);
  });
  await check('notification refusal never blocks mission reward or ordinary account usage',async()=> {
    const id=await user();
    assert.equal((await get(id)).enabled,false);
    const summary=await sync(id,3000);
    assert.equal((await rpc(id,'hl_claim',[summary.instanceId,randomUUID()])).addedPoints,10);
    assert.equal((await get(id)).enabled,false);
    assert.equal((await rpc(id,'hl_consents')).profile.status,'active');
  });
  await check('export includes exact current or default preferences and preserves P21 records',async()=> {
    const id=await user(false), other=await user(false);
    const current=await set(id,{enabled:true,reminderTime:'18:00'});
    const exported=await rpc(id,'hl_export'), defaultExport=await rpc(other,'hl_export');
    assert.deepEqual(exported.notificationPreferences,current); assert.deepEqual(defaultExport.notificationPreferences,defaults);
    assert.ok(Array.isArray(exported.appealAdjustments)); assert.ok(Array.isArray(exported.redemptions)); assert.ok(Array.isArray(exported.ledger));
    assert.equal(exported.profile.id,id); assert.equal(defaultExport.profile.id,other);
    assert.equal('userId' in exported.notificationPreferences,false);
  });
  await check('deletion races preferences safely; purge removes row and old JWT cannot restore it',async()=> {
    const id=await user(); await set(id,{enabled:true});
    const results=await Promise.allSettled([set(id,{enabled:true,reminderTime:'18:00'},1),rpc(id,'hl_request_deletion')]);
    assert.equal(results[1].status,'fulfilled');
    if(results[0].status==='rejected') assert.equal(results[0].reason.message,'ACCOUNT_INACTIVE');
    await rejected(()=>get(id),'ACCOUNT_INACTIVE'); await rejected(()=>set(id,{enabled:false},2),'ACCOUNT_INACTIVE');
    assert.equal((await session(id,c=>c.query('select * from public.notification_preferences'))).rows.length,0);
    await service('hl_purge_deletion',[results[1].value.jobId]); await service('hl_purge_deletion',[results[1].value.jobId]);
    await service('hl_complete_deletion',[results[1].value.jobId]);
    assert.equal((await admin.query('select count(*)::integer n from public.notification_preferences where user_id=$1',[id])).rows[0].n,0);
    await rejected(()=>get(id),'ACCOUNT_INACTIVE'); await rejected(()=>set(id,{enabled:true}),'ACCOUNT_INACTIVE');
    await rejected(()=>rpc(id,'hl_set_consents',[true,true,true,false,'2026-09-18']),'ACCOUNT_INACTIVE');
    assert.equal((await admin.query('select account_key from public.profiles where id=$1',[id])).rows[0].account_key,null);
  });
}
