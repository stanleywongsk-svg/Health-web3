import { describe, expect, it, vi } from 'vitest';
import { CoreApiError, type CoreClient, type NotificationPreferences } from '@healthloop/api-client';
import { ConsentController } from './consent-controller';
import { createChunkedStorage } from './secure-storage-core';
import { ReminderController, defaultReminder, reminderDisabledKey, type ReminderChoices, type ReminderPermission } from './reminder-controller';

const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}};
function fixture(enabled=false){
  let saved:NotificationPreferences={...defaultReminder,enabled,revision:enabled?1:0,updatedAt:enabled?'2026-09-20T01:00:00Z':null};
  let scheduled:ReminderChoices|null=null;
  const data=new Map<string,string>();
  const storage={getItem:vi.fn(async(key:string)=>data.get(key)??null),setItem:vi.fn(async(key:string,value:string)=>{data.set(key,value)}),removeItem:vi.fn(async(key:string)=>{data.delete(key)})};
  const driver={permission:vi.fn(async():Promise<ReminderPermission>=>'granted'),requestPermission:vi.fn(async():Promise<ReminderPermission>=>'granted'),cancel:vi.fn(async()=>{scheduled=null}),schedule:vi.fn(async(value:ReminderChoices)=>{scheduled={...value}})};
  const api={getNotificationPreferences:vi.fn<CoreClient['getNotificationPreferences']>(async()=>({...saved})),setNotificationPreferences:vi.fn<CoreClient['setNotificationPreferences']>(async input=>{
    if(input.expectedRevision!==saved.revision)throw new CoreApiError('PREFERENCES_CONFLICT',409);
    const {expectedRevision,...settings}=input;saved={...settings,revision:expectedRevision+1,updatedAt:'2026-09-20T02:00:00Z'};return {...saved};
  })};
  const make=()=>{const controller=new ReminderController({api,storage,driver});controller.setContext('a',true);return controller};
  return {api,driver,storage,data,make,current:()=>saved,scheduled:()=>scheduled};
}
describe('optional local reminder lifecycle',()=>{
  it('starts disabled, never prompts on refresh, and works without health/marketing settings',async()=>{
    const f=fixture();const c=f.make();await c.refresh();expect(c.getSnapshot()).toMatchObject({ready:true,draft:{enabled:false},schedule:'off'});
    expect(f.driver.requestPermission).not.toHaveBeenCalled();expect(f.driver.schedule).not.toHaveBeenCalled();expect(f.api.setNotificationPreferences).not.toHaveBeenCalled();
  });
  it('requires an explicit save and OS permission before persisting and scheduling one generic reminder',async()=>{
    const f=fixture();f.driver.permission.mockResolvedValue('undetermined');const c=f.make();await c.refresh();await c.change({enabled:true});
    expect(f.driver.requestPermission).not.toHaveBeenCalled();expect(f.driver.schedule).not.toHaveBeenCalled();
    f.driver.requestPermission.mockImplementation(async()=>{f.driver.permission.mockResolvedValue('granted');return 'granted'});
    const first=c.save();expect(c.save()).toBe(first);await first;
    expect(f.driver.requestPermission).toHaveBeenCalledTimes(1);expect(f.api.setNotificationPreferences).toHaveBeenCalledTimes(1);
    expect(f.scheduled()).toEqual({...defaultReminder,enabled:true});expect(c.getSnapshot().schedule).toBe('scheduled');
    expect(Object.keys(f.driver.schedule.mock.calls[0]![0]).sort()).toEqual(['enabled','quietEnd','quietStart','reminderTime','timezone']);
  });
  it.each(['denied','unavailable'] as const)('keeps notification permission %s optional and does not enable account reminders',async permission=>{
    const f=fixture();f.driver.permission.mockResolvedValue(permission);const c=f.make();await c.refresh();await c.change({enabled:true});
    await expect(c.save()).rejects.toMatchObject({code:permission==='denied'?'NOTIFICATIONS_DENIED':'NOTIFICATIONS_UNAVAILABLE',status:0});
    expect(f.api.setNotificationPreferences).not.toHaveBeenCalled();expect(f.scheduled()).toBeNull();expect(c.getSnapshot().ready).toBe(true);
  });
  it('rejects malformed or quiet-hour reminder times before posting or requesting permission',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.change({enabled:true,reminderTime:'22:00'});
    await expect(c.save()).rejects.toMatchObject({code:'INVALID_REMINDER_TIME'});await c.change({reminderTime:'24:01'});
    await expect(c.save()).rejects.toMatchObject({code:'INVALID_REMINDER_TIME'});expect(f.api.setNotificationPreferences).not.toHaveBeenCalled();expect(f.driver.requestPermission).not.toHaveBeenCalled();
  });
  it('persists immediate offline stop and does not resurrect server-enabled reminders after restart',async()=>{
    const f=fixture(true);const c=f.make();await c.refresh();expect(f.scheduled()).not.toBeNull();
    c.setContext('a',false);await c.change({enabled:false});expect(f.scheduled()).toBeNull();expect(f.data.get(reminderDisabledKey('a'))).toBe('disabled');
    const reopened=f.make();await reopened.refresh();expect(reopened.getSnapshot().draft.enabled).toBe(false);expect(f.scheduled()).toBeNull();expect(f.current().enabled).toBe(true);
    await reopened.save();expect(f.current().enabled).toBe(false);expect(f.data.has(reminderDisabledKey('a'))).toBe(false);
  });
  it('a late enabled-save response cannot undo a newer local disable',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.change({enabled:true});const response=deferred<NotificationPreferences>();f.api.setNotificationPreferences.mockReturnValueOnce(response.promise);
    const saving=c.save();await vi.waitFor(()=>expect(f.api.setNotificationPreferences).toHaveBeenCalledTimes(1));await c.change({enabled:false});
    response.resolve({...defaultReminder,enabled:true,revision:1,updatedAt:'2026-09-20T02:00:00Z'});await expect(saving).rejects.toMatchObject({code:'CANCELLED'});
    expect(f.data.get(reminderDisabledKey('a'))).toBe('disabled');expect(f.scheduled()).toBeNull();expect(c.getSnapshot().draft.enabled).toBe(false);
  });
  it('does not schedule an ambiguous committed save until a fresh canonical read confirms it',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.change({enabled:true});const apply=f.api.setNotificationPreferences.getMockImplementation()!;
    f.api.setNotificationPreferences.mockImplementationOnce(async(...args)=>{await apply(...args);throw new CoreApiError('NETWORK_ERROR',0)});
    await expect(c.save()).rejects.toMatchObject({code:'NOTIFICATION_API_ERROR'});expect(f.current().enabled).toBe(true);expect(f.scheduled()).toBeNull();
    await c.reload();expect(f.scheduled()?.enabled).toBe(true);expect(f.api.setNotificationPreferences).toHaveBeenCalledTimes(1);
  });
  it('preserves a stale draft on conflict and needs canonical reload before another save',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.change({enabled:true});f.api.setNotificationPreferences.mockRejectedValueOnce(new CoreApiError('PREFERENCES_CONFLICT',409));
    await expect(c.save()).rejects.toMatchObject({code:'PREFERENCES_CONFLICT'});expect(c.getSnapshot()).toMatchObject({dirty:true,draft:{enabled:true},errorCode:'PREFERENCES_CONFLICT'});expect(f.scheduled()).toBeNull();
    await c.reload();expect(c.getSnapshot()).toMatchObject({dirty:false,draft:{enabled:false}});
  });
  it('serializes a slow A schedule cleanup before scheduling B and prevents cross-account state',async()=>{
    const f=fixture(true);const c=f.make();const pending=deferred<void>();f.driver.schedule.mockImplementationOnce(async value=>{await pending.promise;return f.driver.schedule.getMockImplementation()!(value)});
    const old=c.refresh();await vi.waitFor(()=>expect(f.driver.schedule).toHaveBeenCalledTimes(1));c.setContext('b',true);
    f.api.getNotificationPreferences.mockResolvedValue({...defaultReminder,enabled:true,reminderTime:'18:00',revision:2,updatedAt:'2026-09-20T02:00:00Z'});
    const fresh=c.refresh();pending.resolve();await expect(old).rejects.toMatchObject({code:'CANCELLED'});await fresh;
    expect(c.getSnapshot()).toMatchObject({accountId:'b',draft:{reminderTime:'18:00'},schedule:'scheduled'});expect(f.scheduled()?.reminderTime).toBe('18:00');
  });
  it('cancels a partially successful native schedule and reports that delivery is unconfirmed',async()=>{
    const f=fixture();const c=f.make();await c.refresh();await c.change({enabled:true});f.driver.schedule.mockRejectedValueOnce(new Error('native failure'));
    await c.save();expect(f.current().enabled).toBe(true);expect(c.getSnapshot()).toMatchObject({schedule:'error',errorCode:'NOTIFICATION_SCHEDULE_ERROR'});expect(f.scheduled()).toBeNull();
    await c.refresh();expect(c.getSnapshot().schedule).toBe('scheduled');
  });
  it('clears any app-owned pending reminder when launching signed out',async()=>{
    const f=fixture(true);const c=new ReminderController({api:f.api,storage:f.storage,driver:f.driver});c.setContext(null,false);await c.stop();expect(f.driver.cancel).toHaveBeenCalled();expect(f.driver.schedule).not.toHaveBeenCalled();
  });
  it.each(['permission','storage'] as const)('an optional %s failure never invalidates core account consent',async failure=>{
    const f=fixture();const c=f.make();await c.refresh();
    const profile={id:'a',status:'active' as const,adultConfirmed:true,localRead:true,cloudSync:true,marketing:false,consentVersion:'2026-09-18'};
    const authority=new ConsentController({api:{getConsents:async()=>({profile}),setConsents:async()=>({profile})},storage:f.storage});await authority.start('a');
    let operation:Promise<void>;
    if(failure==='permission'){await c.change({enabled:true});f.driver.permission.mockRejectedValueOnce(new Error('native unavailable'));operation=c.save()}
    else{f.storage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));operation=c.refresh()}
    const error=await operation.catch(error=>error);expect(error).toMatchObject({code:'NOTIFICATION_STATE_ERROR',status:0});await authority.handleFailure(error);
    expect(authority.getSnapshot()).toMatchObject({connection:'online',localAllowed:true,cloudAllowed:true});expect(f.scheduled()).toBeNull();
  });
  it('a corrupt local stop record fails closed without installing a server-enabled reminder',async()=>{
    const f=fixture(true);f.data.set(reminderDisabledKey('a'),'not-a-valid-record');const c=f.make();await expect(c.refresh()).rejects.toMatchObject({code:'NOTIFICATION_STATE_ERROR'});expect(f.scheduled()).toBeNull();
  });
  it.each(['INVALID_RESPONSE','NETWORK_ERROR','TIMEOUT'])('keeps optional API %s failure separate from confirmed core access',async failure=>{
    const f=fixture();const c=f.make();await c.refresh();
    const profile={id:'a',status:'active' as const,adultConfirmed:true,localRead:true,cloudSync:true,marketing:false,consentVersion:'2026-09-18'};
    const authority=new ConsentController({api:{getConsents:async()=>({profile}),setConsents:async()=>({profile})},storage:f.storage});await authority.start('a');
    f.api.getNotificationPreferences.mockRejectedValueOnce(new CoreApiError(failure,0));
    const error=await c.refresh().catch(error=>error);expect(error).toMatchObject({code:'NOTIFICATION_API_ERROR'});await authority.handleFailure(error);
    expect(authority.getSnapshot()).toMatchObject({connection:'online',localAllowed:true,cloudAllowed:true});expect(c.getSnapshot()).toMatchObject({ready:false,errorCode:'NOTIFICATION_API_ERROR'});
  });
  it.each(['UNAUTHENTICATED','SESSION_UNAVAILABLE','ACCOUNT_INACTIVE'])('still forwards actual account failure %s to account authority',async failure=>{
    const f=fixture();const c=f.make();f.api.getNotificationPreferences.mockRejectedValueOnce(new CoreApiError(failure,failure==='UNAUTHENTICATED'?401:403));
    await expect(c.refresh()).rejects.toMatchObject({code:failure});expect(f.driver.schedule).not.toHaveBeenCalled();
  });
  it.each([401,403])('does not hide HTTP %s behind a malformed optional response',async status=>{
    const f=fixture();const c=f.make();f.api.getNotificationPreferences.mockRejectedValueOnce(new CoreApiError('INVALID_RESPONSE',status));
    await expect(c.refresh()).rejects.toMatchObject({code:'INVALID_RESPONSE',status});expect(f.driver.schedule).not.toHaveBeenCalled();
  });
  it('a newer canonical disabled read invalidates an older read paused during native permission checking',async()=>{
    const f=fixture(true);const c=f.make();const pending=deferred<ReminderPermission>();
    f.driver.permission.mockReturnValueOnce(pending.promise);
    const old=c.refresh();await vi.waitFor(()=>expect(f.driver.permission).toHaveBeenCalledTimes(1));
    f.api.getNotificationPreferences.mockResolvedValue({...defaultReminder,revision:2,updatedAt:'2026-09-20T02:00:00Z'});
    const fresh=c.refresh();await vi.waitFor(()=>expect(c.getSnapshot().saved?.enabled).toBe(false));
    pending.resolve('granted');await expect(old).rejects.toMatchObject({code:'CANCELLED'});await fresh;
    expect(f.driver.schedule).not.toHaveBeenCalled();expect(c.getSnapshot().schedule).toBe('off');
  });
  it('a missing SecureStore stop-marker chunk stays fail-closed after controller and storage restart',async()=>{
    const f=fixture(true);const chunks=new Map<string,string>();
    const driver={get:async(key:string)=>chunks.get(key)??null,set:async(key:string,value:string)=>{chunks.set(key,value)},remove:async(key:string)=>{chunks.delete(key)}};
    const storage=createChunkedStorage(driver,()=> 'one');await storage.setItem(reminderDisabledKey('a'),'disabled');
    const manifest=JSON.parse(chunks.get('hl.'+reminderDisabledKey('a'))!) as string[];chunks.delete(manifest[0]!);
    const c=new ReminderController({api:f.api,driver:f.driver,storage:createChunkedStorage(driver,()=> 'two')});c.setContext('a',true);
    await expect(c.refresh()).rejects.toMatchObject({code:'NOTIFICATION_STATE_ERROR'});expect(f.driver.schedule).not.toHaveBeenCalled();expect(c.getSnapshot().ready).toBe(false);
  });
});
