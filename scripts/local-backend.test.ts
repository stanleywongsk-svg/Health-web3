import { describe, expect, it } from 'vitest';
// @ts-expect-error Standalone Node launcher is intentionally JavaScript, outside the TS production graph.
import { LocalCommandError, captureFailureReason, ownedContainers } from './local-backend.mjs';
// @ts-expect-error Standalone Node adapter is intentionally JavaScript, outside the TS production graph.
import { PROJECT_ID, NETWORK_ID } from './docker-loopback.mjs';
const oldId='a'.repeat(12),newId='b'.repeat(12),otherId='c'.repeat(12);
const safe={name:`/supabase_edge_runtime_${PROJECT_ID}`,projectLabel:PROJECT_ID,networks:{[NETWORK_ID]:{}},bindings:{},ports:{},running:true,health:null};
const inspectArgs=['inspect','--format','selected-fields',oldId];
describe('local container replacement verification',()=>{
  it('classifies only exact missing immutable IDs and never general Docker failures',()=>{
    expect(captureFailureReason(inspectArgs,`Error: No such object: ${oldId}\n`)).toBe('missing-container');
    expect(captureFailureReason(inspectArgs,`Error response from daemon: No such container: ${oldId}`)).toBe('missing-container');
    for(const error of ['',`Error: No such object: ${newId}`,`Error: No such object: ${oldId}\npermission denied`,'Cannot connect to Docker daemon','secret diagnostic sentinel']) {
      expect(captureFailureReason(inspectArgs,error)).toBe('command-error');
    }
    expect(captureFailureReason(['network','inspect',oldId],`Error: No such object: ${oldId}`)).toBe('command-error');
    expect(captureFailureReason(['inspect','--format','selected-fields','container-name'],`Error: No such object: ${oldId}`)).toBe('command-error');
  });
  it('re-lists and inspects new immutable IDs when the Edge container is replaced',async()=>{
    const calls:string[][]=[];
    const run=async(_command:string,args:string[])=>{
      calls.push(args);
      if(args[0]==='ps') return calls.length===1?oldId:newId;
      if(args.includes(oldId)) throw new LocalCommandError('Docker container inspection','missing-container',1);
      return JSON.stringify(safe);
    };
    expect(await ownedContainers('docker',{},run)).toEqual({ids:[newId],containers:[safe]});
    expect(calls.map(args=>args[0])).toEqual(['ps','inspect','ps','inspect']);
    expect(calls[3]?.at(-1)).toBe(newId);
  });
  it('validates partial inspected rows immediately and rejects an unsafe port before any retry',async()=>{
    let calls=0;
    const unsafe={...safe,bindings:{'8000/tcp':[{HostIp:'0.0.0.0',HostPort:'54321'}]}};
    const run=async(_command:string,args:string[])=>{
      calls++;if(args[0]==='ps') return `${oldId}\n${otherId}`;
      throw new LocalCommandError('Docker container inspection','missing-container',1,JSON.stringify(unsafe));
    };
    await expect(ownedContainers('docker',{},run)).rejects.toThrow('loopback policy');expect(calls).toBe(2);
  });
  it('fails closed on mismatched ownership, malformed rows and incomplete successful output',async()=>{
    for(const output of [JSON.stringify({...safe,projectLabel:'other-project'}),'not-json','']) {
      const run=async(_command:string,args:string[])=>args[0]==='ps'?oldId:output;
      await expect(ownedContainers('docker',{},run)).rejects.toThrow();
    }
  });
  it('does not retry nontransient errors or echo arbitrary output in diagnostics',async()=>{
    let calls=0;const failure=new LocalCommandError('Docker container inspection','command-error',1,'SENSITIVE_SENTINEL');
    const run=async(_command:string,args:string[])=>{calls++;if(args[0]==='ps')return oldId;throw failure;};
    await expect(ownedContainers('docker',{},run)).rejects.toBe(failure);expect(calls).toBe(2);
    expect(String(failure)).not.toContain('SENSITIVE_SENTINEL');expect(failure.inspectedOutput).toBe('');
  });
  it('bounds repeated replacement races and never accepts uninspected containers',async()=>{
    let calls=0;
    const run=async(_command:string,args:string[])=>{calls++;if(args[0]==='ps')return oldId;throw new LocalCommandError('Docker container inspection','missing-container',1);};
    await expect(ownedContainers('docker',{},run)).rejects.toThrow('three verification attempts');expect(calls).toBe(6);
  });
});
