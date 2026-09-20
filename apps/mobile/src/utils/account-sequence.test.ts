import { expect, it, vi } from 'vitest';
import { runAccountSequence } from './account-sequence';
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
