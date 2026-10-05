import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { addTaskDays } from '@healthloop/domain';
import type { Mission } from '@healthloop/api-client';
import type { HealthLoopState } from '../services/use-healthloop';
import { earnView, type Navigate, type EarnAction } from '../utils/earn-view';
import { Button, Copy, Progress, Status } from './ui';
import { t, tx, type TranslationKey } from '../i18n';
import { theme } from '../theme';

export function currentEarn(s: HealthLoopState) {
  const day = s.days.find(row => row.date === s.today);
  return earnView({ date:s.today, snapshot:s.missionSnapshot, eligible:day?.steps.eligible,
    canSubmit:!!day?.steps.pin && !!day.observedAt, localAllowed:s.localAllowed, cloudReady:s.cloudReady,
    online:s.connection === 'online', releaseReady:s.releaseState.policy==='verified', pendingDates:s.pendingDates });
}
const actionLabels: Record<EarnAction, TranslationKey> = {
  reconnect:'reconnect', release:'refreshRelease', reload:'refreshMissions', consent:'setUpEarn', read:'readActivity', sync:'sync', retry:'retryPending', claim:'claimVerified', review:'viewReview', rewards:'exploreRewards',
};
const actionHelp: Record<EarnAction, TranslationKey> = {
  reconnect:'earnOffline', release:'releaseUnavailable', reload:'earnRefresh', consent:'earnConsent', read:'earnRead', sync:'earnSync', retry:'earnRetry', claim:'earnClaim', review:'earnReview', rewards:'earnReward',
};
export function EarnActionButton({state:s,navigate}:{state:HealthLoopState;navigate:Navigate}) {
  const view = currentEarn(s);
  const actions: Record<EarnAction,()=>void> = {
    reconnect:s.reconnect, release:s.reload, reload:s.reload, consent:()=>navigate('profile','privacy'), read:()=>void s.refreshHealth(!s.updated),
    sync:s.sync, retry:s.sync, claim:()=>{if(view.claimId)void s.claimAccepted(view.claimId)}, review:()=>navigate('profile','corrections'), rewards:()=>navigate('points'),
  };
  return <View style={{gap:10}}>
    <Button label={t(actionLabels[view.action])} onPress={actions[view.action]} busy={s.busy}/>
    <Copy muted>{t(actionHelp[view.action])}</Copy>
  </View>;
}
export function DailyTiers({mission,localSteps}:{mission:Mission;localSteps:number|null}) {
  return <View style={{gap:12}}>{mission.tiers.map(tier=>{
    const posted = mission.awardedPoints >= tier.points;
    const reached = localSteps !== null && localSteps >= tier.steps;
    return <View key={tier.steps} style={styles.tier}>
      <View style={styles.tierDetail}><Copy large>{tier.steps.toLocaleString('zh-CN')} {t('steps')}</Copy><Copy muted>{tx('tierTotal',{points:tier.points})}</Copy></View>
      <Status label={t(posted?'tierPosted':reached?'tierToVerify':'tierNotReached')} tone={posted?'positive':reached?'warning':'neutral'}/>
    </View>;
  })}</View>;
}
export function WeeklyProgress({mission}:{mission:Mission}) {
  const weekdays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
  return <View style={{gap:14}}>
    <Copy large>{tx('weeklyProgress',{days:mission.qualifyingDates.length,required:mission.weeklyDaysRequired})}</Copy>
    <Progress value={Math.min(1,mission.qualifyingDates.length/mission.weeklyDaysRequired)} label={t('verifiedActivityDays')}/>
    <View style={styles.week}>{weekdays.map((key,i)=>{
      const date=addTaskDays(mission.periodStart,i);const done=mission.qualifyingDates.includes(date);
      return <View key={key} accessible accessibilityLabel={`${date} · ${t(key)} · ${t(done?'qualifiedDay':'unqualifiedDay')}`} style={[styles.day,done&&styles.done]}>
        <Text style={styles.dayLabel}>{t(key)}</Text><Text style={[styles.dayMark,done&&{color:theme.primary}]}>{done?'✓':'—'}</Text>
      </View>;
    })}</View>
    <Copy muted>{tx('weeklyRule',{goal:mission.selectedGoal.toLocaleString('zh-CN'),days:mission.weeklyDaysRequired,points:mission.weeklyBonusPoints})}</Copy>
    {mission.pendingReview&&<Status label={t('weekPending')} tone="warning"/>}
  </View>;
}
const styles=StyleSheet.create({tier:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:10,paddingVertical:12,borderBottomWidth:1,borderColor:theme.line},tierDetail:{gap:3},week:{flexDirection:'row',flexWrap:'wrap',gap:6},day:{flexGrow:1,minWidth:32,paddingHorizontal:7,paddingVertical:10,gap:6,alignItems:'center',borderRadius:14,backgroundColor:theme.bg,borderWidth:1,borderColor:theme.line},done:{backgroundColor:theme.pale,borderColor:theme.primary},dayLabel:{fontSize:12,color:theme.muted},dayMark:{fontSize:18,fontWeight:'600',color:theme.muted}});
