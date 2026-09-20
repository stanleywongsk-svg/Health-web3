import { z } from 'zod';
import { activitySyncSchema, appealSchema, claimSchema, consentSchema } from '@healthloop/domain';
import { demoActivitySyncSchema } from '@healthloop/domain/synthetic';

export interface CoreConfig {
  url: string; anonKey: string; environment: 'development' | 'test' | 'production';
  buildMode: 'real' | 'demo'; projectLabel: string; allowedOrigins: string[];
}
export function loadConfig(get: (name: string) => string | undefined): CoreConfig {
  const parsed = z.strictObject({
    url: z.url(), anonKey: z.string().min(1), environment: z.enum(['development','test','production']),
    buildMode: z.enum(['real','demo']), projectLabel: z.string().min(1), allowedOrigins: z.array(z.url()),
  }).parse({
    url:get('SUPABASE_URL'), anonKey:get('SUPABASE_ANON_KEY'), environment:get('HEALTHLOOP_ENV'),
    buildMode:get('HEALTHLOOP_BUILD_MODE'), projectLabel:get('HEALTHLOOP_PROJECT_LABEL'),
    allowedOrigins:(get('HEALTHLOOP_ALLOWED_ORIGINS')??'').split(',').filter(Boolean),
  });
  const endpoint = new URL(parsed.url);
  if (!['http:','https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname!=='/') {
    throw new Error('Backend URL must be an HTTP(S) origin without credentials or extra paths.');
  }
  const local = ['localhost','127.0.0.1','[::1]','kong'].includes(endpoint.hostname) || /^supabase_kong_healthloop-local(?:-[a-z0-9]+)*$/.test(endpoint.hostname);
  if (parsed.buildMode==='demo' && (!local || parsed.environment==='production' || !parsed.projectLabel.startsWith('healthloop-local-'))) {
    throw new Error('Demo requires a disposable local backend and healthloop-local-* label.');
  }
  if (parsed.environment==='production' && (endpoint.protocol!=='https:' || local || !parsed.projectLabel.startsWith('healthloop-real-'))) {
    throw new Error('Production requires HTTPS and an explicit healthloop-real-* label.');
  }
  for (const origin of parsed.allowedOrigins) {
    if (new URL(origin).origin!==origin) throw new Error('CORS entries must be exact origins.');
  }
  return parsed;
}
export interface RequestClient {
  auth: { getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{data:unknown; error:{message:string;code?:string}|null}>;
}
export interface Dependencies { client(token:string):RequestClient; requestId?():string; }
const errors: Record<string, [number,string]> = {
  UNAUTHENTICATED:[401,'请重新登录'], FORBIDDEN:[403,'无权执行此操作'], ACCOUNT_INACTIVE:[403,'账户已停用'],
  CONSENT_REQUIRED:[403,'请先确认云端同步同意'], ONBOARDING_REQUIRED:[409,'请先完成使用说明与同意'],
  INVALID_INPUT:[422,'提交内容不符合要求'], SOURCE_REJECTED:[422,'此来源不能用于奖励'], SOURCE_PINNED:[409,'当天已固定其他来源'],
  REVISION_CONFLICT:[409,'摘要版本已更新，请重新同步'], IDEMPOTENCY_CONFLICT:[409,'请求编号已用于其他操作'],
  CUTOFF_PASSED:[409,'已超过自动计奖截止时间，可提交更正申请'], REWARDS_PAUSED:[503,'奖励发放暂时停止'],
  RATE_LIMITED:[429,'操作过于频繁，请稍后再试'], NOT_FOUND:[404,'未找到记录'], SUMMARY_REQUIRED:[409,'请先同步当天摘要'],
  CLAIM_DAILY_FIRST:[409,'请先领取每日任务，周奖励会自动计算'], INSUFFICIENT_POINTS:[409,'可用积分不足'],
  OUT_OF_STOCK:[409,'演示奖励名额不足'], REAUTHENTICATION_REQUIRED:[401,'请在五分钟内重新使用电邮验证码登录'],
  RULES_UNAVAILABLE:[503,'任务规则暂不可用'], BODY_TOO_LARGE:[413,'提交内容过大'], NOT_SUPPORTED:[404,'此功能暂未提供'],
  INTERNAL_ERROR:[500,'服务暂时不可用，请稍后再试'],
};
class ApiError extends Error { constructor(readonly code:string) { super(code); } }
async function jsonBody(req:Request):Promise<unknown> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError('INVALID_INPUT');
  if (Number(req.headers.get('content-length')??0)>8192) throw new ApiError('BODY_TOO_LARGE');
  const reader=req.body?.getReader(); if(!reader) throw new ApiError('INVALID_INPUT');
  const parts:Uint8Array[]=[]; let length=0;
  try {
    while(true) { const part=await reader.read(); if(part.done) break; length+=part.value.length;
      if(length>8192) { await reader.cancel(); throw new ApiError('BODY_TOO_LARGE'); } parts.push(part.value); }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(length); let offset=0; for(const part of parts) { bytes.set(part,offset); offset+=part.length; }
  try { return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); } catch { throw new ApiError('INVALID_INPUT'); }
}
const ledgerQuery=z.strictObject({limit:z.coerce.number().int().min(1).max(100).default(20),cursor:z.string().regex(/^[1-9]\d{0,17}$/).optional()});
const redemptionQuery=ledgerQuery;
export function createCoreHandler(config:CoreConfig,deps:Dependencies):(req:Request)=>Promise<Response> {
  return async(req)=> {
    const requestId=deps.requestId?.()??crypto.randomUUID();
    const origin=req.headers.get('origin');
    const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','X-Request-Id':requestId};
    if(origin && config.allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin']=origin;
      headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
      headers['Access-Control-Allow-Methods']='GET, POST, DELETE, OPTIONS';
    }
    const failure=(code:string)=>{const [status,message]=errors[code]??errors.INTERNAL_ERROR!;return new Response(JSON.stringify({error:{code:errors[code]?code:'INTERNAL_ERROR',message},requestId}),{status,headers});};
    if(origin && !config.allowedOrigins.includes(origin)) return failure('FORBIDDEN');
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
    try {
      // Cookie sessions are not accepted; all mutations require a bearer access token.
      const authorization=req.headers.get('authorization');
      if(!authorization?.startsWith('Bearer ') || authorization.length>8192) throw new ApiError('UNAUTHENTICATED');
      const token=authorization.slice(7); const client=deps.client(token);
      const verified=await client.auth.getUser(token);
      if(verified.error || !verified.data.user) throw new ApiError('UNAUTHENTICATED');
      const url=new URL(req.url);
      const path=url.pathname.replace(/^\/functions\/v1\/core(?=\/|$)/,'').replace(/^\/core(?=\/|$)/,'')||'/';
      let name:string; let args:Record<string,unknown>={};
      if(req.method==='POST' && path==='/activity/sync') {
        const input=(config.buildMode==='demo'?demoActivitySyncSchema:activitySyncSchema).parse(await jsonBody(req));
        name='hl_sync_activity'; args={p_task_date:input.taskDate,p_eligible_steps:input.eligibleSteps,p_source_category:input.sourceCategory,
          p_source_policy:input.sourcePolicy,p_source_pin_token:input.sourcePinToken,p_revision:input.revision,p_observed_at:input.observedAt,p_timezone:input.timezone};
      } else if(req.method==='POST' && path==='/account/consents') {
        const i=consentSchema.parse(await jsonBody(req));name='hl_set_consents';args={p_adult_confirmed:i.adultConfirmed,p_local_read:i.localRead,p_cloud_sync:i.cloudSync,p_marketing:i.marketing,p_version:i.version};
      } else if(req.method==='GET' && path==='/account/consents') name='hl_consents';
      else if(req.method==='GET' && path==='/health/summary') name='hl_health_summary';
      else if(req.method==='GET' && path==='/missions') name='hl_missions';
      else if(req.method==='GET' && path==='/points/summary') name='hl_points_summary';
      else if(req.method==='GET' && path==='/points/ledger') {
        const i=ledgerQuery.parse(Object.fromEntries(url.searchParams));name='hl_ledger';args={p_limit:i.limit,p_cursor:i.cursor??null};
      } else if(req.method==='POST' && /^\/missions\/[^/]+\/claim$/.test(path)) {
        const id=z.uuid().parse(path.split('/')[2]); const i=claimSchema.parse(await jsonBody(req));name='hl_claim';args={p_instance_id:id,p_idempotency_key:i.idempotencyKey};
      } else if(req.method==='GET' && path==='/rewards') name='hl_rewards';
      else if(req.method==='GET' && path==='/redemptions') {
        const i=redemptionQuery.parse(Object.fromEntries(url.searchParams));name='hl_redemptions';args={p_limit:i.limit,p_cursor:i.cursor??null};
      } else if(req.method==='POST' && path==='/redemptions') {
        const i=z.strictObject({rewardId:z.uuid(),idempotencyKey:z.uuid()}).parse(await jsonBody(req));name='hl_redeem';args={p_reward_id:i.rewardId,p_idempotency_key:i.idempotencyKey};
      } else if(req.method==='POST' && /^\/redemptions\/[^/]+\/cancel$/.test(path)) {
        const id=z.uuid().parse(path.split('/')[2]);z.strictObject({}).parse(await jsonBody(req));name='hl_cancel_redemption';args={p_redemption_id:id};
      } else if(req.method==='POST' && path==='/appeals') {
        const i=appealSchema.parse(await jsonBody(req));name='hl_create_appeal';args={p_task_date:i.taskDate,p_reason:i.reason};
      } else if(req.method==='POST' && path==='/account/export') { z.strictObject({}).parse(await jsonBody(req)); name='hl_export'; }
      else if(req.method==='DELETE' && path==='/account') { z.strictObject({}).parse(await jsonBody(req)); name='hl_request_deletion'; }
      else if(req.method==='POST' && path==='/admin/reward-pause') {
        const i=z.strictObject({paused:z.boolean(),reason:z.string().trim().min(10).max(1000)}).parse(await jsonBody(req));name='hl_admin_pause';args={p_paused:i.paused,p_reason:i.reason};
      } else throw new ApiError('NOT_SUPPORTED');
      const result=await client.rpc(name,args);
      if(result.error) throw new ApiError(errors[result.error.message]?result.error.message:'INTERNAL_ERROR');
      return new Response(JSON.stringify({data:result.data,requestId}),{status:200,headers});
    } catch(e) {
      if(e instanceof z.ZodError) return failure('INVALID_INPUT');
      if(e instanceof ApiError) return failure(e.code);
      return failure('INTERNAL_ERROR');
    }
  };
}
