import { expect,it } from 'vitest';
import { createChunkedStorage } from './secure-storage-core';
function setup(){const data=new Map<string,string>();let id=0;const storage=createChunkedStorage({get:async k=>data.get(k)??null,set:async(k,v)=>{await Promise.resolve();data.set(k,v)},remove:async k=>{data.delete(k)}},()=>String(++id));return {data,storage}}
it('serializes rapid consent changes so withdrawal wins and removes superseded chunks',async()=>{const {data,storage}=setup();const a=storage.setItem('consent.a','true');const b=storage.setItem('consent.a','false');await Promise.all([a,b]);expect(await storage.getItem('consent.a')).toBe('false');expect(data.size).toBe(2)});
it('keeps long credentials in bounded chunks and clears every chunk on logout',async()=>{const {data,storage}=setup();const token='a'.repeat(7100);await storage.setItem('auth',token);expect(await storage.getItem('auth')).toBe(token);expect([...data.values()].every(v=>v.length<=1800)).toBe(true);await storage.removeItem('auth');expect(data.size).toBe(0);expect(await storage.getItem('auth')).toBeNull()});
it('reads after an outstanding withdrawal wait for the write',async()=>{const {storage}=setup();await storage.setItem('consent.a','true');const write=storage.setItem('consent.a','false');expect(await storage.getItem('consent.a')).toBe('false');await write});
it('does not remove chunks underneath an already-started read',async()=>{
  const data=new Map<string,string>();let id=0;let release!:()=>void;let started!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve});const reading=new Promise<void>(resolve=>{started=resolve});let pause=false;
  const storage=createChunkedStorage({get:async key=>{if(pause&&key.startsWith('hl.intent.')){started();await gate}return data.get(key)??null},set:async(key,value)=>{data.set(key,value)},remove:async key=>{data.delete(key)}},()=>String(++id));
  await storage.setItem('intent','original-key');pause=true;
  const read=storage.getItem('intent');await reading;
  const remove=storage.removeItem('intent');const write=storage.setItem('intent','next-key');
  await Promise.resolve();release();
  expect(await read).toBe('original-key');await Promise.all([remove,write]);expect(await storage.getItem('intent')).toBe('next-key');
});
it('returns null only for an absent manifest, while an empty value round-trips explicitly',async()=>{
  const {data,storage}=setup();expect(await storage.getItem('empty')).toBeNull();
  await storage.setItem('empty','');expect(await storage.getItem('empty')).toBe('');
  expect(JSON.parse(data.get('hl.empty')!)).toEqual(['hl.empty.1.0']);
  await storage.removeItem('empty');expect(await storage.getItem('empty')).toBeNull();
});
it.each(['','not-json','null','false','12','"secret-token"','{}','[]','[null]','[12]','["wrong-key"]'])(
  'rejects corrupt manifest %s without echoing its contents',async manifest=>{
    const {data,storage}=setup();data.set('hl.intent',manifest);
    await expect(storage.getItem('intent')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR',message:'LOCAL_STATE_ERROR'});
  },
);
it('treats a missing local-reminder disable chunk as corruption after a new storage instance',async()=>{
  const {data,storage}=setup();const key='reminder-disabled.v1.account-a';
  await storage.setItem(key,'disabled');
  const [part]=JSON.parse(data.get(`hl.${key}`)!) as string[];data.delete(part!);
  const restarted=createChunkedStorage({get:async k=>data.get(k)??null,set:async(k,v)=>{data.set(k,v)},remove:async k=>{data.delete(k)}},()=> 'next');
  await expect(restarted.getItem(key)).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  expect(data.has(`hl.${key}`)).toBe(true);
});
it('rejects missing or truncated credential chunks instead of returning partial credentials',async()=>{
  const {data,storage}=setup();await storage.setItem('auth','a'.repeat(3601));
  const parts=JSON.parse(data.get('hl.auth')!) as string[];
  data.delete(parts[1]!);await expect(storage.getItem('auth')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  data.set(parts[1]!,'a'.repeat(1799));await expect(storage.getItem('auth')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  data.set(parts[1]!,'a'.repeat(1800));data.set(parts[2]!,'');await expect(storage.getItem('auth')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  data.set(parts[2]!,'a');expect(await storage.getItem('auth')).toBe('a'.repeat(3601));
});
it.each([
  ['hl.intent.1.0','hl.intent.1.0'],
  ['hl.intent.1.1800','hl.intent.1.0'],
  ['hl.intent.1.0','hl.intent.2.1800'],
  ['hl.intent.1.0','hl.intent.1.3600'],
  ['hl.intent.1.00'],
  ['hl.other.1.0'],
])('rejects unordered, duplicated, mixed-version and cross-key manifests %#',async(...parts:string[])=>{
  const {data,storage}=setup();data.set('hl.intent',JSON.stringify(parts));data.set('hl.other.1.0','private-value');
  await expect(storage.getItem('intent')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  await expect(storage.removeItem('intent')).rejects.toMatchObject({code:'LOCAL_STATE_ERROR'});
  expect(data.get('hl.other.1.0')).toBe('private-value');
});
