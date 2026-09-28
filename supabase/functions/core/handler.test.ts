import assert from 'node:assert/strict';
import { createCoreHandler, loadConfig, type CoreConfig, type RequestClient } from './handler.ts';
const config:CoreConfig={url:'http://localhost:54321',anonKey:'local-test-key',environment:'test',buildMode:'real',projectLabel:'healthloop-local-http',allowedOrigins:['http://localhost:8081']};
const sample={taskDate:'2026-09-18',eligibleSteps:5000,sourceCategory:'apple_phone',sourcePolicy:'single-approved-source-v1',sourcePinToken:'5694922e-0962-4da2-bdeb-40c4a4e8908b',revision:1,observedAt:'2026-09-18T01:00:00Z',timezone:'Asia/Hong_Kong'};
function fixture(options:{authFail?:boolean; rpcError?:string;demo?:boolean;data?:unknown}={}) {
  const calls:Array<{name:string;args:Record<string,unknown>|undefined}>=[];
  let validated=0;
  const client:RequestClient={auth:{getUser:async(token)=>{
    validated++; assert.equal(token,'test-access-token');return {data:{user:options.authFail?null:{id:'verified-user'}},error:options.authFail?new Error('expired JWT'):null};
  }},rpc:async(name,args)=>{calls.push({name,args});return {data:options.data??{ok:true},error:options.rpcError?{message:options.rpcError}:null};}};
  return {calls,get validated(){return validated;},handler:createCoreHandler({...config,buildMode:options.demo?'demo':'real'}, {client:()=>client,requestId:()=> 'test-request-id'})};
}
function request(path:string,method='GET',body?:unknown,headers:Record<string,string>={}) {
  return new Request(`http://localhost/functions/v1/core${path}`,{method,headers:{authorization:'Bearer test-access-token','content-type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
Deno.test('HTTP rejects missing auth without RPC',async()=>{
  const f=fixture();const response=await f.handler(new Request('http://localhost/core/missions'));assert.equal(response.status,401);assert.equal(f.calls.length,0);
});
Deno.test('HTTP validates session through getUser before RPC and rejects expired token',async()=>{
  const f=fixture({authFail:true});const response=await f.handler(request('/missions'));assert.equal(response.status,401);assert.equal(f.validated,1);assert.equal(f.calls.length,0);
});
Deno.test('HTTP validates shared sync schema and maps fields without user ID',async()=>{
  const f=fixture();const response=await f.handler(request('/activity/sync','POST',sample));assert.equal(response.status,200);assert.equal(f.validated,1);
  assert.equal(f.calls[0]?.name,'hl_sync_activity');assert.equal(f.calls[0]?.args?.p_eligible_steps,5000);assert.equal(Object.keys(f.calls[0]?.args??{}).includes('user_id'),false);
  assert.deepEqual(await response.json(),{data:{ok:true},requestId:'test-request-id'});
});
Deno.test('HTTP rejects forged identity, malformed calendar dates and fractional steps',async()=>{
  for(const change of [{userId:'victim'},{taskDate:'2026-02-30'},{eligibleSteps:2.5},{eligibleSteps:-1},{sourceCategory:'manual'}]) {
    const f=fixture();assert.equal((await f.handler(request('/activity/sync','POST',{...sample,...change}))).status,422);assert.equal(f.calls.length,0);
  }
});
Deno.test('HTTP demo and native source schemas are mutually exclusive',async()=>{
  const synthetic={...sample,sourceCategory:'synthetic_demo',sourcePolicy:'synthetic-demo-v1'};
  assert.equal((await fixture().handler(request('/activity/sync','POST',synthetic))).status,422);
  assert.equal((await fixture({demo:true}).handler(request('/activity/sync','POST',sample))).status,422);
  assert.equal((await fixture({demo:true}).handler(request('/activity/sync','POST',synthetic))).status,200);
});
Deno.test('HTTP CORS blocks unapproved origins and permits explicit origin',async()=>{
  const f=fixture();assert.equal((await f.handler(request('/missions','GET',undefined,{origin:'https://attacker.example'}))).status,403);assert.equal(f.calls.length,0);
  const r=await f.handler(request('/missions','GET',undefined,{origin:'http://localhost:8081'}));assert.equal(r.headers.get('access-control-allow-origin'),'http://localhost:8081');
  assert.equal(r.headers.get('cache-control'),'no-store');
});
Deno.test('HTTP bounded ledger cursors and request bodies reject bad input',async()=>{
  const f=fixture();assert.equal((await f.handler(request('/points/ledger?limit=101'))).status,422);
  assert.equal((await f.handler(request('/points/ledger?limit=2&cursor=abc'))).status,422);
  assert.equal((await f.handler(request('/appeals','POST',{taskDate:'2026-09-18',reason:'x'.repeat(9000)}))).status,413);assert.equal(f.calls.length,0);
});
Deno.test('HTTP known database errors map semantics; unknown details never escape',async()=>{
  const known=await fixture({rpcError:'CONSENT_REQUIRED'}).handler(request('/missions'));assert.equal(known.status,403);
  const unknown=await fixture({rpcError:'internal secret database stack'}).handler(request('/missions'));assert.equal(unknown.status,500);
  assert.equal((await unknown.text()).includes('internal secret'),false);
});
Deno.test('HTTP mutation and identifier routes validate empty schemas and UUIDs',async()=>{
  const f=fixture();assert.equal((await f.handler(request('/missions/not-a-uuid/claim','POST',{idempotencyKey:sample.sourcePinToken}))).status,422);
  assert.equal((await f.handler(request('/account','DELETE',{userId:'victim'}))).status,422);
  assert.equal((await f.handler(request('/account/export','POST',{}))).status,200);assert.equal(f.calls[0]?.name,'hl_export');
});
Deno.test('HTTP unsupported route is explicit and never a false success',async()=>{
  assert.equal((await fixture().handler(request('/admin/adjustments'))).status,404);
});
Deno.test('startup demo guard blocks remote backends and production',()=>{
  const env={SUPABASE_URL:'http://localhost:54321',SUPABASE_ANON_KEY:'public-key',HEALTHLOOP_ENV:'test',HEALTHLOOP_BUILD_MODE:'demo',HEALTHLOOP_PROJECT_LABEL:'healthloop-local-http'};
  const from=(data:Record<string,string>)=>loadConfig(k=>data[k]);
  assert.equal(from(env).buildMode,'demo');
  assert.throws(()=>from({...env,SUPABASE_URL:'https://real-project.supabase.co'}));
  assert.throws(()=>from({...env,HEALTHLOOP_ENV:'production'}));
  assert.throws(()=>from({...env,HEALTHLOOP_PROJECT_LABEL:'healthloop-real-live'}));
  assert.throws(()=>from({...env,HEALTHLOOP_ALLOWED_ORIGINS:'https://example.test/path'}));
});
Deno.test('startup rejects disguised remote demo hosts and credential-bearing URLs',()=>{
  for(const url of ['http://supabase_kong_healthloop-local-dev.evil.invalid','http://user:password@localhost:54321','ftp://localhost','http://localhost:54321?key=secret']) {
    const env:Record<string,string>={SUPABASE_URL:url,SUPABASE_ANON_KEY:'public',HEALTHLOOP_ENV:'test',HEALTHLOOP_BUILD_MODE:'demo',HEALTHLOOP_PROJECT_LABEL:'healthloop-local-http'};
    assert.throws(()=>loadConfig(k=>env[k]));
  }
});

const appealId='00000000-0000-4000-8000-000000000021';
const proposalId='00000000-0000-4000-8000-000000000022';
const idempotencyKey='00000000-0000-4000-8000-000000000023';
const reviewReason='核实已保存的修订与申诉说明';
const createdAt='2026-09-20T01:00:00Z';
const proposalInput={appealId,revision:2,reason:reviewReason,idempotencyKey};
const decisionInput={decision:'approve',reason:reviewReason,idempotencyKey};
const proposalResult={id:proposalId,appealId,revision:2,status:'pending',createdAt};
const decisionResult={id:proposalId,appealId,status:'approved',decision:'approve',addedPoints:-50,dailyDelta:-30,weeklyDelta:-20,balance:-40,availablePoints:0,decidedAt:createdAt};

Deno.test('HTTP scoped own/admin queues use bounded cursors and never accept a client subject',async()=>{
  for(const [path,name] of [['/appeals','hl_appeals'],['/admin/reviews','hl_admin_appeals']]) {
    const f=fixture({data:{items:[],nextCursor:null}});
    const response=await f.handler(request(`${path}?limit=10&cursor=9007199254740993`));
    assert.equal(response.status,200);assert.equal(f.validated,1);
    assert.deepEqual(f.calls,[{name,args:{p_limit:10,p_cursor:'9007199254740993'}}]);
    for(const query of ['?userId=victim','?limit=0','?limit=101','?cursor=0','?limit=1&limit=2','?__proto__=subject']) {
      const invalid=fixture();assert.equal((await invalid.handler(request(`${path}${query}`))).status,422);assert.equal(invalid.calls.length,0);
    }
  }
});
Deno.test('HTTP proposal references only a persisted appeal revision and forwards the exact caller key',async()=>{
  const f=fixture({data:proposalResult});
  const first=await f.handler(request('/admin/adjustments','POST',proposalInput));
  const retry=await f.handler(request('/admin/adjustments','POST',proposalInput));
  assert.equal(first.status,200);assert.equal(retry.status,200);
  assert.deepEqual(await first.json(),await retry.json());
  assert.deepEqual(f.calls[0],{name:'hl_propose_appeal',args:{p_appeal_id:appealId,p_revision:2,p_reason:reviewReason,p_idempotency_key:idempotencyKey}});
  assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.validated,2);
});
Deno.test('HTTP decision is an authenticated SQL operation with no client-defined awards',async()=>{
  const f=fixture({data:decisionResult});
  const response=await f.handler(request(`/admin/adjustments/${proposalId}/decision`,'POST',decisionInput));
  assert.equal(response.status,200);
  assert.deepEqual(f.calls,[{name:'hl_decide_appeal',args:{p_proposal_id:proposalId,p_decision:'approve',p_reason:reviewReason,p_idempotency_key:idempotencyKey}}]);
  assert.deepEqual(await response.json(),{data:decisionResult,requestId:'test-request-id'});
});
Deno.test('HTTP rejects forged identities, amounts, readings and invalid review transitions before RPC',async()=>{
  for(const extra of [{userId:appealId},{user_id:appealId},{points:-30},{amount:100},{eligibleSteps:3000},{reviewerId:proposalId},{approved:true}]) {
    for(const [path,body] of [['/admin/adjustments',proposalInput],[`/admin/adjustments/${proposalId}/decision`,decisionInput]] as const) {
      const f=fixture();assert.equal((await f.handler(request(path,'POST',{...body,...extra}))).status,422);assert.equal(f.calls.length,0);
    }
  }
  for(const change of [{revision:0},{revision:1.5},{reason:'too short'},{appealId:'not-an-id'},{idempotencyKey:'not-a-key'}]) {
    const f=fixture();assert.equal((await f.handler(request('/admin/adjustments','POST',{...proposalInput,...change}))).status,422);assert.equal(f.calls.length,0);
  }
  for(const change of [{decision:'reverse'},{reason:'short'},{idempotencyKey:null}]) {
    const f=fixture();assert.equal((await f.handler(request(`/admin/adjustments/${proposalId}/decision`,'POST',{...decisionInput,...change}))).status,422);assert.equal(f.calls.length,0);
  }
  const f=fixture();assert.equal((await f.handler(request('/admin/adjustments/not-an-id/decision','POST',decisionInput))).status,422);assert.equal(f.calls.length,0);
});
Deno.test('HTTP review routes reject invalid Auth before SQL and preserve role/self-review prohibitions',async()=>{
  for(const [path,method,body] of [['/admin/reviews','GET',undefined],['/admin/adjustments','POST',proposalInput],[`/admin/adjustments/${proposalId}/decision`,'POST',decisionInput]] as const) {
    const auth=fixture({authFail:true});assert.equal((await auth.handler(request(path,method,body))).status,401);assert.equal(auth.calls.length,0);
    for(const code of ['FORBIDDEN','SELF_REVIEW']) {
      const f=fixture({rpcError:code});const response=await f.handler(request(path,method,body));
      assert.equal(response.status,403);assert.equal((await response.json()).error.code,code);
    }
  }
});
Deno.test('HTTP maps review stale/replay/closed conflicts distinctly and does not leak unlisted database details',async()=>{
  const expected:Record<string,number>={STALE_PROPOSAL:409,IDEMPOTENCY_CONFLICT:409,APPEAL_CLOSED:409,SUBMISSION_NOT_REVIEWABLE:409,PROPOSAL_DECIDED:409,NOT_FOUND:404,CONSENT_REQUIRED:403,ACCOUNT_INACTIVE:403,REWARDS_PAUSED:503,RATE_LIMITED:429};
  for(const [code,status] of Object.entries(expected)) {
    const f=fixture({rpcError:code});const response=await f.handler(request(`/admin/adjustments/${proposalId}/decision`,'POST',decisionInput));
    assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);assert.equal(f.calls.length,1);
  }
  const response=await fixture({rpcError:'subject health row private details'}).handler(request('/admin/adjustments','POST',proposalInput));
  assert.equal(response.status,500);assert.equal((await response.text()).includes('private details'),false);
});
Deno.test('HTTP rejects malformed or excessive RPC response fields as server failures without exposing them',async()=>{
  for(const data of [
    {...decisionResult,addedPoints:0}, {...decisionResult,availablePoints:20},
    {...decisionResult,status:'rejected'}, {...decisionResult,rawHealth:'private-reading'},
  ]) {
    const response=await fixture({data}).handler(request(`/admin/adjustments/${proposalId}/decision`,'POST',decisionInput));
    assert.equal(response.status,500);const body=await response.text();assert.equal(body.includes('private-reading'),false);assert.equal(body.includes('INTERNAL_ERROR'),true);
  }
  const data={items:[{id:appealId,sequenceId:'1',taskDate:'2026-09-18',reason:reviewReason,status:'open',createdAt,proposals:[],subjectId:proposalId}],nextCursor:null};
  const response=await fixture({data}).handler(request('/appeals'));assert.equal(response.status,500);assert.equal((await response.text()).includes(proposalId),false);
});
Deno.test('HTTP signed balance reconciles compensation and never exposes negative spendable points',async()=>{
  const data={balance:-40,availablePoints:0,pendingEvaluations:0,earnedPoints:50,spentPoints:40,reversedPoints:0,correctionPoints:-50};
  const response=await fixture({data}).handler(request('/points/summary'));assert.equal(response.status,200);assert.deepEqual((await response.json()).data,data);
  assert.equal((await fixture({data:{...data,correctionPoints:-49}}).handler(request('/points/summary'))).status,500);
});
Deno.test('HTTP demo reward schema preserves server cost and stock and rejects arbitrary redemption amount',async()=>{
  const data={items:[{id:appealId,titleKey:'demo_badge',pointsCost:10,stock:1,isDemo:true}]};
  assert.equal((await fixture({data}).handler(request('/rewards'))).status,200);
  assert.equal((await fixture({data:{items:[{...data.items[0],isDemo:false}]}}).handler(request('/rewards'))).status,500);
  const f=fixture();assert.equal((await f.handler(request('/redemptions','POST',{rewardId:appealId,idempotencyKey,pointsCost:1}))).status,422);assert.equal(f.calls.length,0);
});
Deno.test('HTTP demo review administration is explicitly unsupported before RPC, not a synthetic-response 500',async()=>{
  for(const [path,method,body] of [['/admin/reviews','GET',undefined],['/admin/adjustments','POST',proposalInput],[`/admin/adjustments/${proposalId}/decision`,'POST',decisionInput]] as const) {
    const f=fixture({demo:true,data:{items:[{pendingSubmissions:[{sourceCategory:'synthetic_demo'}]}],nextCursor:null}});
    const response=await f.handler(request(path,method,body));
    assert.equal(response.status,404);assert.equal((await response.json()).error.code,'NOT_SUPPORTED');
    assert.equal(f.validated,1);assert.equal(f.calls.length,0);
  }
  // User-visible appeal history remains available without exposing native-only
  // admin submission summaries or granting a demo account review authority.
  const own=fixture({demo:true,data:{items:[],nextCursor:null}});
  assert.equal((await own.handler(request('/appeals'))).status,200);assert.equal(own.calls[0]?.name,'hl_appeals');
  const invalidSession=fixture({demo:true,authFail:true});
  assert.equal((await invalidSession.handler(request('/admin/reviews'))).status,401);assert.equal(invalidSession.calls.length,0);
});

const notificationValues={enabled:false,reminderTime:'19:00',quietStart:'22:00',quietEnd:'08:00',timezone:'Asia/Hong_Kong'};
const notificationDefaults={...notificationValues,revision:0,updatedAt:null};
const preferencePath='/account/notification-preferences';
Deno.test('HTTP notification preferences derive identity from Auth and read the disabled server default',async()=>{
  const f=fixture({data:notificationDefaults});const response=await f.handler(request(preferencePath));
  assert.equal(response.status,200);assert.equal(f.validated,1);assert.deepEqual(f.calls,[{name:'hl_notification_preferences',args:{}}]);
  assert.deepEqual((await response.json()).data,notificationDefaults);
  const missing=await fixture().handler(new Request(`http://localhost/core${preferencePath}`));assert.equal(missing.status,401);
  const expired=fixture({authFail:true});assert.equal((await expired.handler(request(preferencePath))).status,401);assert.equal(expired.calls.length,0);
});
Deno.test('HTTP notification saves forward only desired settings and the expected revision, never reward or health RPCs',async()=>{
  const input={...notificationValues,enabled:true,expectedRevision:4};
  const data={...notificationValues,enabled:true,revision:5,updatedAt:createdAt};
  const f=fixture({data});const response=await f.handler(request(preferencePath,'POST',input));assert.equal(response.status,200);
  assert.deepEqual(f.calls,[{name:'hl_set_notification_preferences',args:{p_enabled:true,p_reminder_time:'19:00',p_quiet_start:'22:00',p_quiet_end:'08:00',p_timezone:'Asia/Hong_Kong',p_expected_revision:4}}]);
  assert.deepEqual((await response.json()).data,data);
  const unverified=fixture({authFail:true});assert.equal((await unverified.handler(request(preferencePath,'POST',input))).status,401);assert.equal(unverified.calls.length,0);
});
Deno.test('HTTP rejects notification identity selectors, arbitrary content, malformed times and revisions before RPC',async()=>{
  for(const extra of [
    {userId:appealId},{user_id:appealId},{points:20},{eligibleSteps:7000},{healthData:[]},{wallet:'unrelated'},
    {notificationBody:'untrusted'},{pushToken:'forbidden'},{revision:4},{updatedAt:createdAt},
    {reminderTime:'24:00'},{quietStart:'9:00'},{quietEnd:'08:60'},{quietEnd:'22:00'},
    {timezone:'UTC'},{expectedRevision:-1},{expectedRevision:0.5},{expectedRevision:2147483648},{enabled:'true'},
  ]) {
    const f=fixture();assert.equal((await f.handler(request(preferencePath,'POST',{...notificationValues,expectedRevision:0,...extra}))).status,422);assert.equal(f.calls.length,0);
  }
  for(const query of ['?userId=victim','?enabled=true','?revision=0&revision=1']) {
    const f=fixture();assert.equal((await f.handler(request(`${preferencePath}${query}`))).status,422);
    assert.equal((await f.handler(request(`${preferencePath}${query}`,'POST',{...notificationValues,expectedRevision:0}))).status,422);assert.equal(f.calls.length,0);
  }
});
Deno.test('HTTP quiet windows reject their inclusive start and permit the exclusive end including midnight wrap',async()=>{
  for(const [quietStart,quietEnd,reminderTime,allowed] of [
    ['22:00','08:00','22:00',false],['22:00','08:00','00:00',false],['22:00','08:00','08:00',true],
    ['09:00','12:30','09:00',false],['09:00','12:30','12:29',false],['09:00','12:30','12:30',true],
  ] as const) {
    const values={...notificationValues,enabled:true,quietStart,quietEnd,reminderTime};
    const f=fixture({data:{...values,revision:1,updatedAt:createdAt}});
    assert.equal((await f.handler(request(preferencePath,'POST',{...values,expectedRevision:0}))).status,allowed?200:422);
    assert.equal(f.calls.length,allowed?1:0);
  }
  const disabled={...notificationValues,reminderTime:'00:00'};
  assert.equal((await fixture({data:{...disabled,revision:1,updatedAt:createdAt}}).handler(request(preferencePath,'POST',{...disabled,expectedRevision:0}))).status,200);
});
Deno.test('HTTP notification conflict, inactive account and rate errors retain stable semantics',async()=>{
  for(const [code,status] of [['PREFERENCES_CONFLICT',409],['ACCOUNT_INACTIVE',403],['ONBOARDING_REQUIRED',409],['RATE_LIMITED',429]] as const) {
    const f=fixture({rpcError:code});const response=await f.handler(request(preferencePath,'POST',{...notificationValues,expectedRevision:0}));
    assert.equal(response.status,status);assert.equal((await response.json()).error.code,code);assert.equal(f.calls.length,1);
  }
  // Equivalent desired state may return its already persisted newer revision.
  const data={...notificationValues,enabled:true,revision:7,updatedAt:createdAt};
  assert.equal((await fixture({data}).handler(request(preferencePath,'POST',{...notificationValues,enabled:true,expectedRevision:1}))).status,200);
});
Deno.test('HTTP does not expose invalid or unrelated notification response fields as successful preferences',async()=>{
  for(const data of [
    {...notificationDefaults,enabled:true},{...notificationDefaults,revision:1},
    {...notificationDefaults,healthData:'private-values'}, {...notificationDefaults,timezone:'UTC'},
  ]) {
    const response=await fixture({data}).handler(request(preferencePath));assert.equal(response.status,500);
    const payload=await response.text();assert.equal(payload.includes('private-values'),false);assert.equal(payload.includes('INTERNAL_ERROR'),true);
  }
  const data={...notificationValues,enabled:true,revision:1,updatedAt:createdAt};
  assert.equal((await fixture({data}).handler(request(preferencePath,'POST',{...notificationValues,expectedRevision:0}))).status,500);
});
