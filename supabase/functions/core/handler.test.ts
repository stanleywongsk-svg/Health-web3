import assert from 'node:assert/strict';
import { createCoreHandler, loadConfig, type CoreConfig, type RequestClient } from './handler.ts';
const config:CoreConfig={url:'http://localhost:54321',anonKey:'local-test-key',environment:'test',buildMode:'real',projectLabel:'healthloop-local-http',allowedOrigins:['http://localhost:8081']};
const sample={taskDate:'2026-09-18',eligibleSteps:5000,sourceCategory:'apple_phone',sourcePolicy:'single-approved-source-v1',sourcePinToken:'5694922e-0962-4da2-bdeb-40c4a4e8908b',revision:1,observedAt:'2026-09-18T01:00:00Z',timezone:'Asia/Hong_Kong'};
function fixture(options:{authFail?:boolean; rpcError?:string;demo?:boolean}={}) {
  const calls:Array<{name:string;args:Record<string,unknown>|undefined}>=[];
  let validated=0;
  const client:RequestClient={auth:{getUser:async(token)=>{
    validated++; assert.equal(token,'test-access-token');return {data:{user:options.authFail?null:{id:'verified-user'}},error:options.authFail?new Error('expired JWT'):null};
  }},rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:options.rpcError?{message:options.rpcError}:null};}};
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
