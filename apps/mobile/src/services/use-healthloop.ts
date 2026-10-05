import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Share } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import { aggregateSteps, summarizeSleep, type StepAggregation, type SourcePin, type MetricResult, type SleepSummary, type HeartRateSample } from '@healthloop/health-provider';
import { CoreApiError, type MissionsResult, type PointsSummary, type LedgerPage, type AppealPage } from '@healthloop/api-client';
import { createSnapshotGate, runDeletionSequence } from '../utils/account-sequence';
import { createMissionClaimRecovery } from '../utils/mission-claim';
import { RewardController, type RewardCanonical } from '../utils/reward-controller';
import { handleCurrentReleaseFailure, ReleaseController } from '../utils/release-controller';
import { ReminderController, type ReminderChoices } from '../utils/reminder-controller';
import { reminderDriver } from './reminders';
import { ConsentGate } from '../utils/consent-gate';
import { ConsentController, consentErrorCode } from '../utils/consent-controller';
import { createActivitySyncCoordinator, latestEligibleObservation, prepareActivitySummary, type ActivitySyncResult } from '../utils/activity-sync';
import { health } from './health';
import { secureStorage } from './secure-storage';
import type { Runtime } from './runtime';
import { t } from '../i18n';
import { errorMessage } from '../utils/error-message';
export const taskDate = (at = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
export const formatTime = (at: string) => new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Hong_Kong',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
export interface DayView { date: string; steps: StepAggregation; observedAt: string | null }
export function useHealthLoop(runtime: Runtime) {
  const authority=useMemo(()=>new ConsentController({api:runtime.api,storage:secureStorage}),[runtime]);
  const releaseController=useMemo(()=>new ReleaseController(runtime.api),[runtime]);
  const coordinator=useMemo(()=>createActivitySyncCoordinator({api:runtime.api,randomUUID:()=>Crypto.randomUUID(),assertMutationAllowed:()=>releaseController.assertEarningAllowed()}),[runtime,releaseController]);
  const claimRecovery=useMemo(()=>createMissionClaimRecovery(runtime.api,()=>Crypto.randomUUID(),()=>releaseController.assertEarningAllowed()),[runtime,releaseController]);
  const rewardController=useMemo(()=>new RewardController({api:runtime.api,storage:secureStorage,randomUUID:()=>Crypto.randomUUID()}),[runtime]);
  const reminderController=useMemo(()=>new ReminderController({api:runtime.api,storage:secureStorage,driver:reminderDriver}),[runtime]);
  const reminderState=useSyncExternalStore(reminderController.subscribe,reminderController.getSnapshot,reminderController.getSnapshot);
  const rewardState=useSyncExternalStore(rewardController.subscribe,rewardController.getSnapshot,rewardController.getSnapshot);
  const releaseState=useSyncExternalStore(releaseController.subscribe,releaseController.getSnapshot,releaseController.getSnapshot);
  const consentState=useSyncExternalStore(authority.subscribe,authority.getSnapshot,authority.getSnapshot);
  const [session,setSession]=useState<Session|null>(null);
  const [loading,setLoading]=useState(true);
  const [adult,setAdult]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [days,setDays]=useState<DayView[]>([]);
  const [updated,setUpdated]=useState<string|null>(null);
  const [missionSnapshot,setMissionSnapshot]=useState<MissionsResult|null>(null);
  const [today,setToday]=useState(taskDate);
  useEffect(()=>{const timer=setInterval(()=>setToday(taskDate()),30_000);return()=>clearInterval(timer)},[]);
  const [points,setPoints]=useState<PointsSummary|null>(null);
  const [ledger,setLedger]=useState<LedgerPage>({items:[],nextCursor:null});
  const [appeals,setAppeals]=useState<AppealPage>({items:[],nextCursor:null});
  const [sleep,setSleep]=useState<MetricResult<SleepSummary>>({status:'no_data'});
  const [sleepSources,setSleepSources]=useState<string[]>([]);
  const [heartSources,setHeartSources]=useState<string[]>([]);
  const [heart,setHeart]=useState<MetricResult<HeartRateSample>>({status:'no_data'});
  const [pendingDates,setPendingDates]=useState<string[]>([]);
  const gate=useRef(new ConsentGate()).current;
  const serverSnapshots=useRef(createSnapshotGate()).current;
  const account=useRef<string|null>(null);
  const accountEpoch=useRef(0);
  const readRunning=useRef(false);
  const submissionRunning=useRef(false);
  const accountRequests=useRef(new Set<AbortController>());
  const [logoutPending,setLogoutPending]=useState(false);
  const signingOut=useRef(false);
  const [lastCodeAt,setLastCodeAt]=useState(0);
  const clearHealth=()=>{health.cancel();setDays([]);setUpdated(null);setSleep({status:'no_data'});setHeart({status:'no_data'});setSleepSources([]);setHeartSources([]);health.clearSourceLabels()};
  const clearTransient=()=>{accountEpoch.current++;serverSnapshots.invalidate();claimRecovery.clear();for(const request of accountRequests.current)request.abort();accountRequests.current.clear();gate.cancel();clearHealth();setBusy(false);setPoints(null);setMissionSnapshot(null);setLedger({items:[],nextCursor:null});setAppeals({items:[],nextCursor:null});setPendingDates([]);setAdult(false);setMessage('')};
  useEffect(()=>{
    const update=()=>{
      const state=authority.getSnapshot();claimRecovery.setAccount(state.accountId);if(!state.localAllowed||!state.draft.cloudSync)claimRecovery.clear();gate.configure(state.accountId,state.localAllowed,state.cloudAllowed);
      rewardController.setContext({accountId:state.accountId,verified:state.connection==='online'&&state.onboarded,redeemAllowed:false});
      releaseController.setContext(state.accountId,state.connection==='online'&&state.onboarded);
      reminderController.setContext(state.accountId,state.connection==='online'&&state.onboarded);
      if(!state.localAllowed)clearHealth();
      if(!state.accountId||state.connection==='blocked'||!state.localAllowed||!state.draft.cloudSync){coordinator.setContext({accountId:state.accountId,cloudSync:false});setPendingDates([])}
      else if(state.connection!=='online')coordinator.pause();
      else coordinator.setContext({accountId:state.accountId,cloudSync:state.cloudAllowed});
      if(state.connection!=='online')for(const request of accountRequests.current)request.abort();
      if(state.connection==='blocked'||state.connection==='signed_out'){setPoints(null);setMissionSnapshot(null);setLedger({items:[],nextCursor:null});setAppeals({items:[],nextCursor:null})}
      if(state.onboarded)setAdult(true);
    };
    update();return authority.subscribe(update);
  },[authority,coordinator,claimRecovery,rewardController,releaseController,reminderController,gate]);
  useEffect(()=>{
    let active=true;let authEventObserved=false;
    const accept=(next:Session|null)=>{if(!active||(signingOut.current&&next))return;if(account.current!==(next?.user.id??null)){clearTransient();account.current=next?.user.id??null;authority.setAccount(account.current)}setSession(next);setLoading(false)};
    runtime.auth.auth.getSession().then(({data,error})=>{if(!authEventObserved){if(error){setMessage(t('sessionExpired'));accept(null)}else accept(data.session)}}).catch(()=>{if(active&&!authEventObserved){setMessage(t('sessionExpired'));accept(null)}});
    const {data}=runtime.auth.auth.onAuthStateChange((_event,next)=>{authEventObserved=true;accept(next)});
    const subscription=AppState.addEventListener('change',state=>{if(state==='active')runtime.auth.auth.startAutoRefresh();else runtime.auth.auth.stopAutoRefresh()});
    return()=>{active=false;data.subscription.unsubscribe();subscription.remove();authority.setAccount(null);gate.cancel();health.cancel();coordinator.setContext({accountId:null,cloudSync:false});rewardController.setContext({accountId:null,verified:false,redeemAllowed:false});releaseController.setContext(null,false);reminderController.setContext(null,false);runtime.auth.auth.stopAutoRefresh()};
  },[runtime,authority,coordinator,rewardController,releaseController,reminderController,gate]);
  const requireOnline=()=>{if(authority.getSnapshot().connection!=='online')throw new CoreApiError('RECONNECT_REQUIRED',0)};
  const requireEarning=()=>{requireOnline();releaseController.assertEarningAllowed()};
  const refreshRelease=async(signal?:AbortSignal)=>{
    const id=account.current;const epoch=accountEpoch.current;
    try{await releaseController.refresh(signal)}catch(error){
      // A disabled or unavailable release policy must not lock account privacy or refunds.
      // Authentication failures still invalidate the account through the existing authority.
      await handleCurrentReleaseFailure(error,()=>id===account.current&&epoch===accountEpoch.current&&!signal?.aborted,failure=>authority.handleFailure(failure));
    }
  };
  const reloadServer=async(signal?:AbortSignal)=>{
    requireOnline();const id=account.current;const epoch=accountEpoch.current;const snapshotIsCurrent=serverSnapshots.beginRead();
    const [m,rewards,a]=await Promise.all([runtime.api.getMissions(signal),rewardController.refresh(signal),runtime.api.getAppeals({},signal),refreshRelease(signal)]);
    if(snapshotIsCurrent()&&id===account.current&&epoch===accountEpoch.current&&!signal?.aborted&&authority.getSnapshot().connection==='online'){setMissionSnapshot(m);setPoints(rewards.points);setLedger(rewards.ledger);setAppeals(a);await reminderController.refresh()}
  };
  const act=async(action:()=>Promise<void>,fallback=t('error'))=>{
    const id=account.current;const epoch=accountEpoch.current;setBusy(true);setMessage('');
    try{await action()}catch(error){if(id===account.current&&epoch===accountEpoch.current){if(consentErrorCode(error)!=='CANCELLED'){await authority.handleFailure(error);if(id===account.current&&epoch===accountEpoch.current)setMessage(errorMessage(error,fallback))}}}
    finally{if(id===account.current&&epoch===accountEpoch.current)setBusy(false)}
  };
  const serverAction=async(action:(signal:AbortSignal)=>Promise<void>)=>{requireOnline();const request=new AbortController();accountRequests.current.add(request);try{await action(request.signal)}finally{accountRequests.current.delete(request)}};
  useEffect(()=>{
    if(!session){setLoading(false);return}
    const id=session.user.id;const epoch=accountEpoch.current;let active=true;setLoading(true);
    authority.start(id).then(async()=>{if(active&&id===account.current&&epoch===accountEpoch.current&&authority.getSnapshot().connection==='online'&&authority.getSnapshot().onboarded)await serverAction(reloadServer)}).catch(async error=>{if(active&&id===account.current&&epoch===accountEpoch.current){await authority.handleFailure(error);if(active&&id===account.current&&epoch===accountEpoch.current)setMessage(errorMessage(error,t('error')))}}).finally(()=>{if(active&&id===account.current&&epoch===accountEpoch.current)setLoading(false)});
    return()=>{active=false};
  },[session?.user.id,authority]);
  const reconnect=()=>act(async()=>{const id=account.current;const epoch=accountEpoch.current;await authority.reconnect();if(id===account.current&&epoch===accountEpoch.current&&authority.getSnapshot().connection==='online'&&authority.getSnapshot().onboarded){await serverAction(reloadServer);if(id===account.current&&epoch===accountEpoch.current)setMessage(t('reconnected'))}});
  const reconnectRef=useRef(reconnect);reconnectRef.current=reconnect;
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active'&&account.current)void reconnectRef.current()});return()=>listener.remove()},[]);
  const sendCode=(email:string)=>act(async()=>{if(Date.now()-lastCodeAt<60000){setMessage(t('resendWait'));return}const {error}=await runtime.auth.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});if(error)throw error;setLastCodeAt(Date.now());setMessage(t('sent'))},t('authError'));
  const verify=(email:string,token:string)=>act(async()=>{const {error}=await runtime.auth.auth.verifyOtp({email:email.trim(),token:token.trim(),type:'email'});if(error)throw error},t('authError'));
  const changeConsent=(field:'localRead'|'cloudSync'|'marketing',value:boolean)=>{void act(()=>authority.change(field,value),t('consentPending'))};
  const saveConsent=()=>act(async()=>{if(!adult){setMessage(t('adultNeeded'));return}const id=account.current;const epoch=accountEpoch.current;if(await authority.save(adult)){if(id!==account.current||epoch!==accountEpoch.current)return;setMessage(t('consentSaved'));await serverAction(reloadServer)}},t('consentPending'));
  const readHealth=async(request=false)=>{
    if(readRunning.current)return;const operation=gate.begin();const id=account.current;readRunning.current=true;
    try{
      if(request)await health.requestReadAccess(['steps']);if(!operation.isCurrent())return;
      if((await health.getAccessState()).platform==='unavailable'){setMessage(t('unavailable'));return}
      const rows:DayView[]=[];const today=taskDate();
      for(let i=6;i>=0;i--){
        if(!operation.isCurrent())return;
        const date=taskDate(new Date(Date.parse(today+'T12:00:00+08:00')-i*86400000));const samples=await health.readSteps(date,operation.signal);
        if(!operation.isCurrent())return;
        if(samples.status==='present'){
          const stored=await secureStorage.getItem(`pin.${id}.${date}`);if(!operation.isCurrent())return;
          const pin=stored?JSON.parse(stored) as SourcePin:undefined;
          const steps=aggregateSteps({taskDate:date,samples:samples.value,pinnedSource:pin,newPinToken:Crypto.randomUUID()});
          if(steps.pin&&!stored)await secureStorage.setItem(`pin.${id}.${date}`,JSON.stringify(steps.pin));
          rows.push({date,steps,observedAt:latestEligibleObservation({taskDate:date,samples:samples.value,pin:steps.pin})});
        }else rows.push({date,steps:{displayed:samples,eligible:samples,pin:null,excludedReasons:[]},observedAt:null});
      }
      if(operation.isCurrent()){setDays(rows);setUpdated(new Date().toISOString());setMessage('')}
    }finally{operation.finish();readRunning.current=false}
  };
  const refreshHealth=(request=false)=>act(()=>readHealth(request),t('queryError'));
  const applyCanonical=(result:ActivitySyncResult)=>{serverSnapshots.invalidate();rewardController.updateAccounting(result.points,result.ledger);setMissionSnapshot(result.missions);setPoints(result.points);setLedger(result.ledger);setMessage(result.status==='pending_review'?t('pendingReview'):t('syncDone'))};
  const claimAccepted=(instanceId:string)=>act(async()=>{
    requireEarning();serverSnapshots.invalidate();releaseController.invalidateBadges();const operation=gate.begin(true);
    try{
      await claimRecovery.claim(instanceId,operation.signal);
      if(!operation.isCurrent())return;
      await reloadServer(operation.signal);
      if(operation.isCurrent()){claimRecovery.confirmed(instanceId);setMessage(t('syncDone'))}
    }finally{operation.finish()}
  });
  const recentTaskDates=()=>[taskDate(),taskDate(new Date(Date.now()-86400000))];
  const syncDate=(date:string)=>act(async()=>{
    if(submissionRunning.current)return;const operation=gate.begin(true);const id=account.current;submissionRunning.current=true;
    try{
      requireEarning();serverSnapshots.invalidate();releaseController.invalidateBadges();if(!recentTaskDates().includes(date))throw new CoreApiError('INVALID_INPUT',0);
      let result:ActivitySyncResult;
      if(coordinator.pending(date))result=await coordinator.retry(date,{signal:operation.signal});
      else{
        const day=days.find(item=>item.date===date);if(!day)throw new CoreApiError('NO_DATA',0);
        const canonical=await runtime.api.getHealthSummary(operation.signal);if(!operation.isCurrent())return;
        const key=`revision.${id}.${date}`;const previous=Number(await secureStorage.getItem(key)??'0');
        if(!Number.isSafeInteger(previous)||previous<0)throw new CoreApiError('LOCAL_STATE_ERROR',0);
        const revision=Math.max(previous,canonical.items.find(item=>item.taskDate===date)?.revision??0)+1;
        const input=prepareActivitySummary({taskDate:date,steps:day.steps,observedAt:day.observedAt,revision});
        if(!operation.isCurrent())return;await secureStorage.setItem(key,String(revision));if(!operation.isCurrent())return;requireEarning();
        result=await coordinator.submit(input,{signal:operation.signal});
      }
      if(operation.isCurrent()){applyCanonical(result);await refreshRelease(operation.signal)}
    }finally{operation.finish();submissionRunning.current=false;if(id===account.current)setPendingDates(recentTaskDates().filter(day=>coordinator.pending(day)!==null))}
  },t('noNetwork'));
  const optionalRead=(kind:'sleep'|'heart_rate')=>act(async()=>{
    const operation=gate.begin();try{
      await health.requestReadAccess([kind]);if(!operation.isCurrent())return;
      if(kind==='sleep'){const end=new Date();const result=await health.readSleep(new Date(+end-2*86400000).toISOString(),end.toISOString(),operation.signal);if(operation.isCurrent()){setSleep(result.status==='present'?summarizeSleep(result.value):result);setSleepSources(health.getSourceLabels('sleep'))}}
      else{const result=await health.readLatestHeartRate(operation.signal);if(operation.isCurrent()){setHeart(result);setHeartSources(health.getSourceLabels('heartRate'))}}
    }finally{operation.finish()}
  });
  const logout=async()=>{
    signingOut.current=true;clearTransient();account.current=null;authority.setAccount(null);setSession(null);setBusy(true);
    let reminderStopFailed=false;try{await reminderController.stop()}catch{reminderStopFailed=true}
    try{const {error}=await runtime.auth.auth.signOut({scope:'local'});if(error)throw error;setLogoutPending(false);signingOut.current=false;if(reminderStopFailed)setMessage(t('reminderScheduleError'))}
    catch{setLogoutPending(true);setMessage(t('logoutFailed'))}
    finally{setBusy(false)}
  };
  const exportData=()=>act(()=>serverAction(async signal=>{const id=account.current;const data=await runtime.api.exportAccount(signal);if(!signal.aborted&&id===account.current)await Share.share({title:t('exportTitle'),message:JSON.stringify(data,null,2)})}));
  const deleteAccount=(code:string)=>act(async()=>{
    requireOnline();if(!session?.user.email)throw new CoreApiError('UNAUTHENTICATED',401);
    const id=account.current;const epoch=accountEpoch.current;const email=session.user.email;
    const isCurrent=()=>id===account.current&&epoch===accountEpoch.current;
    const {reminderStopFailed}=await runDeletionSequence({
      reauthenticate:async()=>{const {error}=await runtime.auth.auth.verifyOtp({email,token:code.trim(),type:'email'});if(error)throw error},
      stopReminders:()=>reminderController.change({enabled:false}),
      withdrawLocal:()=>authority.change('localRead',false),
      withdrawCloud:()=>authority.change('cloudSync',false),
      deleteRemote:()=>serverAction(signal=>runtime.api.deleteAccount(signal).then(()=>undefined)),
    },isCurrent);
    // The remote deletion is confirmed for A. A late response cannot clear/sign out B.
    if(!isCurrent())return;
    signingOut.current=true;let cleanupFailed=false;
    try{
      const {error}=await runtime.auth.auth.signOut({scope:'local'});if(error)throw error;
      if(isCurrent()){clearTransient();account.current=null;authority.setAccount(null);setSession(null)}
      if(account.current===null){setLogoutPending(false);setMessage(reminderStopFailed?`${t('deleteDone')} ${t('reminderScheduleError')}`:t('deleteDone'))}
    }catch{cleanupFailed=true;if(isCurrent()){clearTransient();account.current=null;authority.setAccount(null);setSession(null);setLogoutPending(true);setMessage(t('logoutFailed'))}}
    finally{if(!cleanupFailed)signingOut.current=false}
  },t('authError'));
  const appeal=(reason:string,date:string)=>act(()=>serverAction(async signal=>{await runtime.api.createAppeal({reason,taskDate:date},signal);if(!signal.aborted){setMessage(t('correctionSent'));const page=await runtime.api.getAppeals({},signal);if(!signal.aborted)setAppeals(page)}}));
  const loadMore=()=>act(()=>serverAction(async signal=>{if(!ledger.nextCursor)return;const next=await runtime.api.getLedger({cursor:ledger.nextCursor},signal);if(!signal.aborted)setLedger({items:[...ledger.items,...next.items],nextCursor:next.nextCursor})}));
  const rewardAction=(expectedAccountId:string,action:(signal:AbortSignal)=>Promise<RewardCanonical>,success:'rewardConfirmed'|'refundConfirmed')=>{
    // Alert callbacks retain the account that opened the confirmation sheet.
    if(expectedAccountId!==account.current)return Promise.resolve();
    return act(()=>serverAction(async signal=>{const epoch=accountEpoch.current;serverSnapshots.invalidate();const result=await action(signal);if(!signal.aborted&&expectedAccountId===account.current&&epoch===accountEpoch.current){serverSnapshots.invalidate();setPoints(result.points);setLedger(result.ledger);setMessage(t(success))}}));
  };
  const cancelReward=(id:string,expectedAccountId:string)=>rewardAction(expectedAccountId,signal=>rewardController.cancel(id,signal),'refundConfirmed');
  const retryReward=()=>{const id=account.current;if(!id)return Promise.resolve();return rewardAction(id,signal=>rewardController.retry(signal),rewardState.pending?.kind==='cancel'?'refundConfirmed':'rewardConfirmed')};
  const loadMoreRedemptions=()=>act(()=>serverAction(signal=>rewardController.loadMore(signal)));
  const loadMoreAppeals=()=>act(()=>serverAction(async signal=>{const cursor=appeals.nextCursor;if(!cursor)return;const page=await runtime.api.getAppeals({cursor},signal);if(!signal.aborted)setAppeals(previous=>({items:[...new Map([...previous.items,...page.items].map(item=>[item.id,item])).values()],nextCursor:page.nextCursor}))}));
  const changeReminder=(patch:Partial<ReminderChoices>)=>{void act(()=>reminderController.change(patch),t('reminderStateError'))};
  const saveReminder=()=>act(async()=>{await reminderController.save();setMessage(t('reminderSaved'))});
  const reloadReminder=()=>act(()=>reminderController.reload());
  const reminderSettingsFailed=()=>setMessage(t('reminderScheduleError'));
  return {reminderState,changeReminder,saveReminder,reloadReminder,reminderSettingsFailed,session,loading,consented:consentState.onboarded,adult,setAdult,consent:consentState.draft,connection:consentState.connection,localAllowed:consentState.localAllowed,cloudReady:consentState.cloudAllowed,busy,message,days,updated,today,missionSnapshot,missions:missionSnapshot?.items??[],points,ledger,rewardState,releaseState,appeals,cancelReward,retryReward,loadMoreRedemptions,loadMoreAppeals,sleep,heart,sleepSources,heartSources,pendingDates,claimAccepted,logoutPending,sendCode,verify,changeConsent,saveConsent,refreshHealth,sync:()=>syncDate(taskDate()),syncDate,reconnect,optionalRead,logout,exportData,deleteAccount,appeal,loadMore,reload:()=>act(()=>serverAction(reloadServer),t('noNetwork'))};
}
export type HealthLoopState=ReturnType<typeof useHealthLoop>;
