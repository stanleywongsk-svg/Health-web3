import { CoreApiError, type CoreClient, type ClaimResult } from '@healthloop/api-client';

/** Retain the original claim key through response loss and canonical-refresh failure. */
export function createMissionClaimRecovery(api:Pick<CoreClient,'claimMission'>,randomUUID:()=>string,assertMutationAllowed?:()=>void) {
  let accountId:string|null=null;
  let generation=0;
  const pending=new Map<string,{key:string;result:ClaimResult|null;running?:Promise<ClaimResult>}>();
  function setAccount(id:string|null) {
    if(id!==accountId){generation++;pending.clear();accountId=id}
  }
  function clear() { generation++;pending.clear(); }
  async function claim(id:string,signal:AbortSignal) {
    if(!accountId)throw new CoreApiError('UNAUTHENTICATED',401);
    if(signal.aborted)throw new CoreApiError('CANCELLED',0);
    const epoch=generation;
    let operation=pending.get(id);
    if(!operation){operation={key:randomUUID(),result:null};pending.set(id,operation)}
    const current=()=>!signal.aborted&&epoch===generation&&pending.get(id)===operation;
    if(!operation.running){
      const item=operation;
      item.running=(async()=>{
        if(!item.result){
          assertMutationAllowed?.();
          const result=await api.claimMission(id,item.key,signal);
          if(!current())throw new CoreApiError('CANCELLED',0);
          item.result=result;
        }
        return item.result;
      })().finally(()=>{item.running=undefined});
    }
    const result=await operation.running;
    if(!current())throw new CoreApiError('CANCELLED',0);
    return result;
  }
  return {setAccount,clear,claim,confirmed:(id:string)=>pending.delete(id)};
}
