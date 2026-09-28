export interface SecureDriver { get(key:string):Promise<string|null>; set(key:string,value:string):Promise<void>; remove(key:string):Promise<void> }
/** Serializes complete reads and mutations, including index/chunks, for each logical key. */
export function createChunkedStorage(driver:SecureDriver,newId:()=>string) {
  const pending=new Map<string,Promise<unknown>>();
  const chunkSize=1800;
  const safe=(key:string)=>'hl.'+key.replace(/[^a-zA-Z0-9_.-]/g,'_');
  // Never include stored contents or key names in corruption errors. In particular,
  // a present but incomplete withdrawal marker must not look like an absent marker.
  const corrupt=()=>Object.assign(new Error('LOCAL_STATE_ERROR'),{code:'LOCAL_STATE_ERROR'});
  const keysFrom=(index:string|null,base:string):string[]|null=>{
    if(index===null)return null;
    let value:unknown;
    try{value=JSON.parse(index)}catch{throw corrupt()}
    if(!Array.isArray(value)||value.length===0)throw corrupt();
    const keys:string[]=[];let version:string|undefined;
    for(let i=0;i<value.length;i++){
      const part:unknown=value[i];
      if(typeof part!=='string'||!part.startsWith(`${base}.`))throw corrupt();
      const suffix=part.slice(base.length+1);
      const match=/^([a-zA-Z0-9_-]+)\.(0|[1-9][0-9]*)$/.exec(suffix);
      if(!match)throw corrupt();
      version??=match[1];
      if(part!==`${base}.${version}.${i*chunkSize}`)throw corrupt();
      keys.push(part);
    }
    return keys;
  };
  const enqueue=<T,>(key:string,operation:()=>Promise<T>)=>{
    const run=(pending.get(key)??Promise.resolve()).catch(()=>undefined).then(operation);
    pending.set(key,run);void run.finally(()=>{if(pending.get(key)===run)pending.delete(key)}).catch(()=>undefined);
    return run;
  };
  return {
    getItem(key:string){return enqueue(key,async()=>{
      const base=safe(key);const keys=keysFrom(await driver.get(base),base);if(keys===null)return null;
      const values=await Promise.all(keys.map(part=>driver.get(part)));
      for(let i=0;i<values.length;i++){
        const value=values[i];
        if(typeof value!=='string'||value.length>chunkSize||(i<values.length-1&&value.length!==chunkSize)
          ||(values.length>1&&i===values.length-1&&value.length===0))throw corrupt();
      }
      return values.join('');
    })},
    setItem(key:string,value:string){return enqueue(key,async()=>{
      const base=safe(key);const previous=keysFrom(await driver.get(base),base)??[];const version=newId();const keys:string[]=[];
      if(!/^[a-zA-Z0-9_-]+$/.test(version))throw corrupt();
      // An empty value still has one explicit chunk, so [] is never a valid index.
      try{for(let i=0;i<Math.max(value.length,1);i+=chunkSize){const part=`${base}.${version}.${i}`;keys.push(part);await driver.set(part,value.slice(i,i+chunkSize))}await driver.set(base,JSON.stringify(keys))}
      catch(error){await Promise.all(keys.map(part=>driver.remove(part)));throw error}
      await Promise.all(previous.map(part=>driver.remove(part)));
    })},
    removeItem(key:string){return enqueue(key,async()=>{const base=safe(key);const previous=keysFrom(await driver.get(base),base)??[];await driver.remove(base);await Promise.all(previous.map(part=>driver.remove(part)))})}
  };
}
