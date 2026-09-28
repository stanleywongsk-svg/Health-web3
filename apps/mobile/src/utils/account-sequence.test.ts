import { expect, it, vi } from 'vitest';
import { runAccountSequence, runDeletionSequence } from './account-sequence';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done});return {promise,resolve}};
it('does not withdraw B or delete B after account A local-withdrawal storage finishes late',async()=>{
  let account='a';const storage=deferred();const withdrawCloud=vi.fn(async()=>{});const deleteRemote=vi.fn(async()=>{});
  const operation=runAccountSequence([async()=>{},()=>storage.promise,withdrawCloud,deleteRemote],()=>account==='a');
  await Promise.resolve();account='b';storage.resolve();await expect(operation).rejects.toMatchObject({code:'CANCELLED'});
  expect(withdrawCloud).not.toHaveBeenCalled();expect(deleteRemote).not.toHaveBeenCalled();
});
it('does not clear or sign out B after A deletion response arrives',async()=>{
  let epoch=1;const request=deferred();const clear=vi.fn(async()=>{});const signOut=vi.fn(async()=>{});
  const operation=runAccountSequence([()=>request.promise,clear,signOut],()=>epoch===1);
  epoch=2;request.resolve();await expect(operation).rejects.toMatchObject({code:'CANCELLED'});expect(clear).not.toHaveBeenCalled();expect(signOut).not.toHaveBeenCalled();
});
it('executes each deletion stage when the same account still owns the action',async()=>{
  const stages:number[]=[];await runAccountSequence([async()=>{stages.push(1)},async()=>{stages.push(2)},async()=>{stages.push(3)}],()=>true);expect(stages).toEqual([1,2,3]);
});
it('still withdraws health consent and deletes after optional reminder cancellation fails',async()=>{
  const stages:string[]=[];
  const result=await runDeletionSequence({
    reauthenticate:async()=>{stages.push('reauth')},
    stopReminders:async()=>{stages.push('reminders');throw new Error('native unavailable')},
    withdrawLocal:async()=>{stages.push('local')},withdrawCloud:async()=>{stages.push('cloud')},deleteRemote:async()=>{stages.push('delete')},
  },()=>true);
  expect(stages).toEqual(['reauth','reminders','local','cloud','delete']);expect(result.reminderStopFailed).toBe(true);
});
it('does not delete the next account when optional reminder cleanup finishes late',async()=>{
  let current=true;const pending=deferred();const required=vi.fn(async()=>{});const stopReminders=vi.fn(()=>pending.promise);
  const operation=runDeletionSequence({reauthenticate:async()=>{},stopReminders,withdrawLocal:required,withdrawCloud:required,deleteRemote:required},()=>current);
  await vi.waitFor(()=>expect(stopReminders).toHaveBeenCalledTimes(1));current=false;pending.resolve();
  await expect(operation).rejects.toMatchObject({code:'CANCELLED'});expect(required).not.toHaveBeenCalled();
});
it('never bypasses reauthentication failure or failed health withdrawal',async()=>{
  const optional=vi.fn(async()=>{});const deleted=vi.fn(async()=>{});
  const stages={reauthenticate:async()=>{throw new Error('reauth required')},stopReminders:optional,withdrawLocal:async()=>{},withdrawCloud:async()=>{},deleteRemote:deleted};
  await expect(runDeletionSequence(stages,()=>true)).rejects.toThrow('reauth required');expect(optional).not.toHaveBeenCalled();
  await expect(runDeletionSequence({...stages,reauthenticate:async()=>{},withdrawLocal:async()=>{throw new Error('storage unavailable')}},()=>true)).rejects.toThrow('storage unavailable');expect(deleted).not.toHaveBeenCalled();
});
