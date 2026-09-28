import { CoreApiError, type CoreClient, type NotificationPreferences, type NotificationPreferencesInput } from '@healthloop/api-client';
import { setNotificationPreferencesSchema } from '@healthloop/domain';

export type ReminderChoices = Omit<NotificationPreferencesInput, 'expectedRevision'>;
export type ReminderPermission = 'unknown' | 'undetermined' | 'granted' | 'denied' | 'unavailable';
export interface ReminderDriver {
  permission(): Promise<ReminderPermission>;
  requestPermission(): Promise<ReminderPermission>;
  cancel(): Promise<void>;
  schedule(choices: ReminderChoices): Promise<void>;
}
interface Storage { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> }
export const reminderDisabledKey = (id:string) => `reminder-disabled.v1.${id}`;
export const defaultReminder: ReminderChoices = { enabled:false, reminderTime:'19:00', quietStart:'22:00', quietEnd:'08:00', timezone:'Asia/Hong_Kong' };
export interface ReminderState {
  accountId:string|null; verified:boolean; ready:boolean; busy:boolean; dirty:boolean;
  saved:NotificationPreferences|null; draft:ReminderChoices; permission:ReminderPermission;
  schedule:'off'|'scheduled'|'blocked'|'error'; errorCode:string|null;
}
const choices = (p:NotificationPreferences):ReminderChoices => ({enabled:p.enabled,reminderTime:p.reminderTime,quietStart:p.quietStart,quietEnd:p.quietEnd,timezone:p.timezone});
const code = (error:unknown) => error instanceof CoreApiError ? error.code : 'NOTIFICATION_STATE_ERROR';
const reminderError = (error:unknown) => {
  if(!(error instanceof CoreApiError))return new CoreApiError('NOTIFICATION_STATE_ERROR',0);
  // Optional endpoint failures do not invalidate otherwise confirmed core consent.
  // Actual session/authorization errors must still reach the account authority.
  if(error.status===401||error.status===403)return error;
  if(['INVALID_RESPONSE','NETWORK_ERROR','TIMEOUT'].includes(error.code))return new CoreApiError('NOTIFICATION_API_ERROR',0);
  return error;
};

/** Optional generic reminders. No health/reward data enters the native driver. */
export class ReminderController {
  private state:ReminderState = { accountId:null,verified:false,ready:false,busy:false,dirty:false,saved:null,draft:{...defaultReminder},permission:'unknown',schedule:'off',errorCode:null };
  private generation=0;
  private initialized=false;
  private edit=0;
  private read=0;
  private disabled=false;
  private nativeQueue:Promise<unknown>=Promise.resolve();
  private saveTask:Promise<void>|null=null;
  private requests=new Set<AbortController>();
  private listeners=new Set<()=>void>();
  constructor(private readonly deps:{api:Pick<CoreClient,'getNotificationPreferences'|'setNotificationPreferences'>; storage:Storage; driver:ReminderDriver}){}
  readonly getSnapshot=()=>this.state;
  readonly subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)}};
  private publish(update:Partial<ReminderState>){this.state={...this.state,...update};for(const listener of this.listeners)listener()}
  private native<T>(operation:()=>Promise<T>):Promise<T>{const task=this.nativeQueue.catch(()=>undefined).then(operation);this.nativeQueue=task;return task}
  private context(){if(!this.state.accountId||!this.state.verified)throw new CoreApiError('RECONNECT_REQUIRED',0);return {id:this.state.accountId,generation:this.generation}}
  private current(context:{id:string;generation:number}){return this.state.accountId===context.id&&this.generation===context.generation&&this.state.verified}
  private assert(context:{id:string;generation:number},edit?:number,read?:number){if(!this.current(context)||(edit!==undefined&&edit!==this.edit)||(read!==undefined&&read!==this.read))throw new CoreApiError('CANCELLED',0)}
  setContext(accountId:string|null,verified:boolean){
    verified=accountId!==null&&verified;
    if(this.initialized&&accountId===this.state.accountId&&verified===this.state.verified)return;
    this.initialized=true;
    const changed=accountId!==this.state.accountId;this.generation++;this.read++;this.edit++;
    for(const request of this.requests)request.abort();this.requests.clear();this.saveTask=null;
    if(changed){this.disabled=false;this.publish({accountId,verified,ready:false,busy:false,dirty:false,saved:null,draft:{...defaultReminder},permission:'unknown',schedule:'off',errorCode:null})}
    else this.publish({verified,ready:false,busy:false,schedule:'off'});
    const generation=this.generation;
    void this.native(async()=>{if(generation===this.generation)await this.deps.driver.cancel()}).catch(()=>{if(generation===this.generation)this.publish({schedule:'error',errorCode:'NOTIFICATION_SCHEDULE_ERROR'})});
  }
  /** Local stop survives a lost server response/relaunch; drafts never enable delivery. */
  async change(patch:Partial<ReminderChoices>){
    const id=this.state.accountId;if(!id)return;
    this.edit++;this.read++;this.publish({draft:{...this.state.draft,...patch},dirty:true,errorCode:null});
    if(patch.enabled===false){
      this.disabled=true;this.publish({schedule:'off'});
      const generation=this.generation;
      const results=await Promise.allSettled([
        this.deps.storage.setItem(reminderDisabledKey(id),'disabled'),
        this.native(async()=>{if(generation===this.generation)await this.deps.driver.cancel()}),
      ]);
      if(generation!==this.generation)return;
      if(results.some(result=>result.status==='rejected')){this.publish({schedule:'error',errorCode:'NOTIFICATION_STATE_ERROR'});throw new CoreApiError('NOTIFICATION_STATE_ERROR',0)}
    }
  }
  async stop(){const generation=this.generation;await this.native(async()=>{if(generation===this.generation)await this.deps.driver.cancel()});if(generation===this.generation)this.publish({schedule:'off'})}
  async reload(){this.edit++;this.publish({dirty:false});await this.refresh()}
  private async apply(context:{id:string;generation:number},value:ReminderChoices,edit:number,read:number){
    try{
      await this.native(async()=>{
        this.assert(context,edit,read);await this.deps.driver.cancel();this.assert(context,edit,read);
        const permission=await this.deps.driver.permission();this.assert(context,edit,read);this.publish({permission,schedule:'off'});
        if(!value.enabled||this.disabled)return;
        if(permission!=='granted'){this.publish({schedule:'blocked'});return}
        try{await this.deps.driver.schedule(value);this.assert(context,edit,read)}
        catch(error){await this.deps.driver.cancel();throw error}
        this.publish({schedule:'scheduled'});
      });
    }catch(error){if(code(error)==='CANCELLED')throw error;this.assert(context,edit,read);this.publish({schedule:'error',errorCode:'NOTIFICATION_SCHEDULE_ERROR'})}
  }
  async refresh(){
    if(this.saveTask){await this.saveTask;return}
    const context=this.context();const read=++this.read;const edit=this.edit;const request=new AbortController();this.requests.add(request);
    try{
      const [value,overlay]=await Promise.all([this.deps.api.getNotificationPreferences(request.signal),this.deps.storage.getItem(reminderDisabledKey(context.id))]);
      this.assert(context,edit);if(read!==this.read)throw new CoreApiError('CANCELLED',0);
      if(overlay!==null&&overlay!=='disabled')throw new CoreApiError('NOTIFICATION_STATE_ERROR',0);
      this.disabled=overlay==='disabled';
      const draft=this.state.dirty?this.state.draft:{...choices(value),enabled:value.enabled&&!this.disabled};
      this.publish({saved:value,draft,ready:true,errorCode:null});
      await this.apply(context,{...choices(value),enabled:value.enabled&&!this.disabled&&!this.state.dirty},edit,read);
    }catch(error){const failure=reminderError(error);if(this.current(context)&&read===this.read)this.publish({ready:false,errorCode:failure.code});throw failure}
    finally{this.requests.delete(request)}
  }
  save():Promise<void>{
    if(this.saveTask)return this.saveTask;
    const context=this.context();if(!this.state.saved||!this.state.ready)return Promise.reject(new CoreApiError('PREFERENCES_REFRESH_REQUIRED',0));
    const parsed=setNotificationPreferencesSchema.safeParse({...this.state.draft,expectedRevision:this.state.saved.revision});
    if(!parsed.success)return Promise.reject(new CoreApiError('INVALID_REMINDER_TIME',0));
    const input=parsed.data;const edit=this.edit;const read=++this.read;const request=new AbortController();this.requests.add(request);this.publish({busy:true,errorCode:null});
    const task=(async()=>{
      if(input.enabled){
        await this.native(async()=>{
          this.assert(context,edit);await this.deps.driver.cancel();this.assert(context,edit);
          let permission=await this.deps.driver.permission();this.assert(context,edit);
          if(permission==='undetermined'){permission=await this.deps.driver.requestPermission();this.assert(context,edit)}
          this.publish({permission,schedule:permission==='granted'?'off':'blocked'});
          if(permission!=='granted')throw new CoreApiError(permission==='unavailable'?'NOTIFICATIONS_UNAVAILABLE':'NOTIFICATIONS_DENIED',0);
        });
      }
      this.assert(context,edit);const value=await this.deps.api.setNotificationPreferences(input,request.signal);this.assert(context,edit);
      // The per-key storage adapter serializes this removal before any later stop.
      await this.deps.storage.removeItem(reminderDisabledKey(context.id));this.assert(context,edit);
      this.disabled=false;this.publish({saved:value,draft:choices(value),dirty:false,ready:true});
      await this.apply(context,choices(value),edit,read);
    })().catch((error:unknown)=>{const failure=reminderError(error);if(this.current(context)&&edit===this.edit)this.publish({errorCode:failure.code});throw failure}).finally(()=>{this.requests.delete(request);if(this.saveTask===task){this.saveTask=null;this.publish({busy:false})}});
    this.saveTask=task;return task;
  }
}
