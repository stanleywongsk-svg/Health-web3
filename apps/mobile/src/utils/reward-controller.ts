import { CoreApiError, type CoreClient, type Reward, type RedemptionPage, type PointsSummary, type LedgerPage } from '@healthloop/api-client';

interface Storage { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> }
type Api=Pick<CoreClient,'getRewards'|'getRedemptions'|'redeemReward'|'cancelRedemption'|'getPointsSummary'|'getLedger'>;
type Intent=({kind:'redeem';rewardId:string;idempotencyKey:string}|{kind:'cancel';redemptionId:string}) & {version:1;stage:'request'|'refresh'};
export interface RewardCanonical { rewards:Reward[]; redemptions:RedemptionPage; points:PointsSummary; ledger:LedgerPage }
export interface RewardState {
  accountId:string|null; ready:boolean; loading:boolean; processing:boolean;
  rewards:Reward[]; redemptions:RedemptionPage; points:PointsSummary|null; ledger:LedgerPage|null; pending:Intent|null;
}
export const rewardIntentKey=(accountId:string)=>`reward-intent.v1.${accountId}`;
export const rewardCancellationKey=(accountId:string)=>`reward-cancellation.v1.${accountId}`;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function parseIntent(value:string):Intent {
  const input=JSON.parse(value) as Partial<Intent> & {rewardId?:string;idempotencyKey?:string;redemptionId?:string};
  if(input.version!==1||!['request','refresh'].includes(input.stage??''))throw new CoreApiError('LOCAL_STATE_ERROR',0);
  if(input.kind==='redeem'&&uuid.test(input.rewardId??'')&&uuid.test(input.idempotencyKey??'')&&Object.keys(input).every(key=>['version','kind','stage','rewardId','idempotencyKey'].includes(key)))return input as Intent;
  if(input.kind==='cancel'&&uuid.test(input.redemptionId??'')&&Object.keys(input).every(key=>['version','kind','stage','redemptionId'].includes(key)))return input as Intent;
  throw new CoreApiError('LOCAL_STATE_ERROR',0);
}
const rejectedWithoutCommit=new Set(['INSUFFICIENT_POINTS','OUT_OF_STOCK','REWARDS_PAUSED','NOT_FOUND','INVALID_INPUT','IDEMPOTENCY_CONFLICT','NOT_SUPPORTED']);

/** Real server operations only. Durable intents contain IDs, never codes or health values. */
export class RewardController {
  private state:RewardState={accountId:null,ready:false,loading:false,processing:false,rewards:[],redemptions:{items:[],nextCursor:null},points:null,ledger:null,pending:null};
  private verified=false;
  private redeemAllowed=false;
  private generation=0;
  private restored=false;
  private redeemIntent:Intent|null=null;
  private cancelIntent:Intent|null=null;
  private requests=new Set<AbortController>();
  private inFlight:Promise<RewardCanonical>|null=null;
  private listeners=new Set<()=>void>();
  private readVersion=0;
  constructor(private readonly deps:{api:Api;storage:Storage;randomUUID:()=>string}){}
  readonly getSnapshot=()=>this.state;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
  private publish(update:Partial<RewardState>){this.state={...this.state,...update};for(const listener of this.listeners)listener()}
  setContext(next:{accountId:string|null;verified:boolean;redeemAllowed:boolean}){
    const changed=next.accountId!==this.state.accountId;
    if(changed||(this.verified&&!next.verified)||(this.redeemAllowed&&!next.redeemAllowed)){
      this.generation++;this.readVersion++;for(const request of this.requests)request.abort();this.requests.clear();this.inFlight=null;
      if(changed){this.restored=false;this.redeemIntent=null;this.cancelIntent=null;this.publish({accountId:next.accountId,ready:false,loading:false,processing:false,rewards:[],redemptions:{items:[],nextCursor:null},points:null,ledger:null,pending:null})}
      else this.publish({ready:next.verified&&this.state.ready,loading:false,processing:false});
    }
    this.verified=next.accountId!==null&&next.verified;this.redeemAllowed=this.verified&&next.redeemAllowed;
  }
  private context(){if(!this.state.accountId||!this.verified)throw new CoreApiError('RECONNECT_REQUIRED',0);return {id:this.state.accountId,generation:this.generation}}
  private assertCurrent(context:{id:string;generation:number},signal?:AbortSignal){if(context.id!==this.state.accountId||context.generation!==this.generation||!this.verified||signal?.aborted)throw new CoreApiError('CANCELLED',0)}
  private request(signal?:AbortSignal){const request=new AbortController();const abort=()=>request.abort();if(signal?.aborted)request.abort();signal?.addEventListener('abort',abort,{once:true});this.requests.add(request);return {request,finish:()=>{signal?.removeEventListener('abort',abort);this.requests.delete(request)}}}
  private async restore(context:{id:string;generation:number},signal?:AbortSignal){
    if(this.restored)return;
    const [redeemRaw,cancelRaw]=await Promise.all([this.deps.storage.getItem(rewardIntentKey(context.id)),this.deps.storage.getItem(rewardCancellationKey(context.id))]);this.assertCurrent(context,signal);
    // Another refresh may have restored this generation and created a new intent
    // while this read was pending. Never replace that newer in-memory intent.
    if(this.restored)return;
    try{
      this.redeemIntent=redeemRaw?parseIntent(redeemRaw):null;this.cancelIntent=cancelRaw?parseIntent(cancelRaw):null;
      if((this.redeemIntent&&this.redeemIntent.kind!=='redeem')||(this.cancelIntent&&this.cancelIntent.kind!=='cancel'))throw new Error('INVALID_INTENT');
    }catch{throw new CoreApiError('LOCAL_STATE_ERROR',0)}
    this.restored=true;this.publish({pending:this.cancelIntent??this.redeemIntent});
  }
  private setIntent(intent:Intent|null,kind:'redeem'|'cancel'){
    if(kind==='redeem')this.redeemIntent=intent;else this.cancelIntent=intent;
    this.publish({pending:this.cancelIntent??this.redeemIntent});
  }

  private async canonical(signal:AbortSignal):Promise<RewardCanonical>{
    const [catalog,redemptions,points,ledger]=await Promise.all([this.deps.api.getRewards(signal),this.deps.api.getRedemptions({limit:20},signal),this.deps.api.getPointsSummary(signal),this.deps.api.getLedger({},signal)]);
    // Fail closed even if an implementation mistakenly bypasses API response validation.
    if(catalog.items.some(reward=>reward.isDemo!==true||!Number.isSafeInteger(reward.pointsCost)||reward.pointsCost<1||!Number.isSafeInteger(reward.stock)||reward.stock<0))throw new CoreApiError('INVALID_RESPONSE',0);
    return {rewards:catalog.items,redemptions,points,ledger};
  }
  updateAccounting(points:PointsSummary,ledger:LedgerPage){if(this.verified){this.readVersion++;this.publish({points,ledger})}}
  async refresh(signal?:AbortSignal):Promise<RewardCanonical>{
    const context=this.context();if(this.inFlight)return this.inFlight;const version=++this.readVersion;const {request,finish}=this.request(signal);this.publish({loading:true,ready:false});
    try{await this.restore(context,request.signal);this.assertCurrent(context,request.signal);const result=await this.canonical(request.signal);this.assertCurrent(context,request.signal);if(version!==this.readVersion)throw new CoreApiError('CANCELLED',0);this.publish({...result,loading:false,ready:true});return result}
    finally{finish();if(context.id===this.state.accountId&&context.generation===this.generation)this.publish({loading:false})}
  }
  async loadMore(signal?:AbortSignal):Promise<void>{
    const context=this.context();const cursor=this.state.redemptions.nextCursor;if(!cursor)return;
    const {request,finish}=this.request(signal);this.publish({loading:true});
    try{const page=await this.deps.api.getRedemptions({limit:20,cursor},request.signal);this.assertCurrent(context,request.signal);if(this.state.redemptions.nextCursor!==cursor)return;const items=new Map([...this.state.redemptions.items,...page.items].map(item=>[item.id,item]));this.publish({redemptions:{items:[...items.values()],nextCursor:page.nextCursor}})}
    finally{finish();if(context.id===this.state.accountId&&context.generation===this.generation)this.publish({loading:false})}
  }
  redeem(rewardId:string,signal?:AbortSignal):Promise<RewardCanonical>{
    this.context();if(!this.redeemAllowed)return Promise.reject(new CoreApiError('CONSENT_REQUIRED',0));
    const pending=this.state.pending;
    if(pending){if(pending.kind!=='redeem'||pending.rewardId!==rewardId)return Promise.reject(new CoreApiError('PENDING_REWARD',0));return this.run(pending,signal)}
    if(!this.state.ready)return Promise.reject(new CoreApiError('REWARDS_REFRESH_REQUIRED',0));
    const reward=this.state.rewards.find(item=>item.id===rewardId);if(!reward||reward.isDemo!==true)return Promise.reject(new CoreApiError('NOT_FOUND',404));
    if(!this.state.points||this.state.points.availablePoints<reward.pointsCost)return Promise.reject(new CoreApiError('INSUFFICIENT_POINTS',409));
    if(reward.stock<1)return Promise.reject(new CoreApiError('OUT_OF_STOCK',409));
    return this.run({version:1,kind:'redeem',rewardId,idempotencyKey:this.deps.randomUUID(),stage:'request'},signal);
  }
  cancel(redemptionId:string,signal?:AbortSignal):Promise<RewardCanonical>{
    this.context();if(this.inFlight&&this.state.pending?.kind!=='cancel')return Promise.reject(new CoreApiError('PENDING_REWARD',0));const pending=this.cancelIntent;
    if(pending){if(pending.kind!=='cancel'||pending.redemptionId!==redemptionId)return Promise.reject(new CoreApiError('PENDING_REWARD',0));return this.run(pending,signal)}
    if(!this.state.ready)return Promise.reject(new CoreApiError('REWARDS_REFRESH_REQUIRED',0));
    const record=this.state.redemptions.items.find(item=>item.id===redemptionId);if(!record||record.status!=='demonstration')return Promise.reject(new CoreApiError('NOT_FOUND',404));
    return this.run({version:1,kind:'cancel',redemptionId,stage:'request'},signal);
  }
  retry(signal?:AbortSignal):Promise<RewardCanonical>{
    this.context();const pending=this.state.pending;if(!pending)return Promise.reject(new CoreApiError('NO_PENDING_REWARD',0));
    // The server may return an existing receipt after withdrawal. A never-committed
    // key is still rejected by its new-redemption consent gate.
    return this.run(pending,signal,true);
  }
  private run(intent:Intent,signal?:AbortSignal,existingReceiptOnly=false):Promise<RewardCanonical>{
    if(this.inFlight)return this.inFlight;
    const context=this.context();const {request,finish}=this.request(signal);
    const storageKey=intent.kind==='redeem'?rewardIntentKey(context.id):rewardCancellationKey(context.id);
    this.readVersion++;this.setIntent(intent,intent.kind);this.publish({processing:true,ready:false});
    const task=Promise.resolve().then(async()=>{
      this.assertCurrent(context,request.signal);
      await this.deps.storage.setItem(storageKey,JSON.stringify(intent));this.assertCurrent(context,request.signal);
      if(intent.stage==='request'){
        if(intent.kind==='redeem'){
          if(!this.redeemAllowed&&!existingReceiptOnly)throw new CoreApiError('CONSENT_REQUIRED',0);
          await this.deps.api.redeemReward({rewardId:intent.rewardId,idempotencyKey:intent.idempotencyKey},request.signal);
        }else await this.deps.api.cancelRedemption(intent.redemptionId,request.signal);
        this.assertCurrent(context,request.signal);
        intent={...intent,stage:'refresh'};
        await this.deps.storage.setItem(storageKey,JSON.stringify(intent));this.assertCurrent(context,request.signal);
        this.setIntent(intent,intent.kind);
      }
      const version=this.readVersion;
      const result=await this.canonical(request.signal);this.assertCurrent(context,request.signal);
      if(version!==this.readVersion)throw new CoreApiError('CANCELLED',0);
      await this.deps.storage.removeItem(storageKey);this.assertCurrent(context,request.signal);
      if(version!==this.readVersion)throw new CoreApiError('CANCELLED',0);
      this.setIntent(null,intent.kind);this.publish({...result,ready:true,processing:false});return result;
    }).catch(async(error:unknown)=>{
      if(context.id===this.state.accountId&&context.generation===this.generation&&!request.signal.aborted&&error instanceof CoreApiError&&intent.stage==='request'&&rejectedWithoutCommit.has(error.code)){
        await this.deps.storage.removeItem(storageKey);this.assertCurrent(context,request.signal);this.setIntent(null,intent.kind);
      }
      throw error;
    }).finally(()=>{finish();if(this.inFlight===task)this.inFlight=null;if(context.id===this.state.accountId&&context.generation===this.generation)this.publish({processing:false})});
    this.inFlight=task;return task;
  }
}
