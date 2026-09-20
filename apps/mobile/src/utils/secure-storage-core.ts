export interface SecureDriver { get(key:string):Promise<string|null>; set(key:string,value:string):Promise<void>; remove(key:string):Promise<void> }
/** Serializes each logical key so overlapping preference writes cannot resurrect old consent. */
export function createChunkedStorage(driver:SecureDriver,newId:()=>string) {
  const pending=new Map<string,Promise<void>>();
  const safe=(key:string)=>'hl.'+key.replace(/[^a-zA-Z0-9_.-]/g,'_');
  const keysFrom=(index:string|null):string[]=>index?JSON.parse(index) as string[]:[];
  const enqueue=(key:string,operation:()=>Promise<void>)=>{
    const run=(pending.get(key)??Promise.resolve()).catch(()=>undefined).then(operation);
    pending.set(key,run);void run.finally(()=>{if(pending.get(key)===run)pending.delete(key)}).catch(()=>undefined);
    return run;
  };
  return {
    async getItem(key:string){await pending.get(key);const keys=keysFrom(await driver.get(safe(key)));if(!keys.length)return null;const values=await Promise.all(keys.map(part=>driver.get(part)));return values.some(value=>value===null)?null:values.join('')},
    setItem(key:string,value:string){return enqueue(key,async()=>{
      const base=safe(key);const previous=keysFrom(await driver.get(base));const version=newId();const keys:string[]=[];
      try{for(let i=0;i<value.length;i+=1800){const part=`${base}.${version}.${i}`;keys.push(part);await driver.set(part,value.slice(i,i+1800))}await driver.set(base,JSON.stringify(keys))}
      catch(error){await Promise.all(keys.map(part=>driver.remove(part)));throw error}
      await Promise.all(previous.map(part=>driver.remove(part)));
    })},
    removeItem(key:string){return enqueue(key,async()=>{const base=safe(key);const previous=keysFrom(await driver.get(base));await driver.remove(base);await Promise.all(previous.map(part=>driver.remove(part)))})}
  };
}
