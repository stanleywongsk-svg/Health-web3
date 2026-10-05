import React from 'react';
import { View } from 'react-native';
import { addTaskDays } from '@healthloop/domain';
import { Button, Card, Copy, PageHeading, Status, Title } from '../components/ui';
import { currentEarn, DailyTiers, EarnActionButton, WeeklyProgress } from '../components/earn';
import { t } from '../i18n';
import { formatTime, type HealthLoopState } from '../services/use-healthloop';
import type { Navigate } from '../utils/earn-view';

export function Missions({state:s,navigate}:{state:HealthLoopState;navigate:Navigate}) {
  const earn=currentEarn(s);
  const history=s.missions.filter(m=>m.id!==earn.daily?.id&&m.id!==earn.weekly?.id);
  return <>
    <PageHeading kicker={t('currentMissions')} title={t('missionTitle')} body={t('missionBody')}/>
    <Card tint>
      <Title>{t('dailyMission')}</Title>
      {earn.daily?<>
        <Copy>{s.today} · {t('goal')} {earn.daily.selectedGoal.toLocaleString('zh-CN')} {t('steps')}</Copy>
        <DailyTiers mission={earn.daily} localSteps={earn.steps}/>
        <Copy muted>{t('dailyCap')} · {t('dailyTotalHelp')}</Copy>
        <Copy>{t('receivedSteps')} · {earn.daily.eligibleSteps===null?'—':earn.daily.eligibleSteps.toLocaleString('zh-CN')}</Copy>
        {earn.daily.pendingReview&&<Status label={t('pendingMission')} tone="warning"/>}
        <Copy muted>{t('deadline')} · {formatTime(earn.daily.cutoffAt)}</Copy><Copy muted>{t('rule')} · {earn.daily.ruleVersion}</Copy>
      </>:<Copy muted>{t('notInstanced')}</Copy>}
      <EarnActionButton state={s} navigate={navigate}/>
    </Card>
    <Card>
      <Title>{t('weeklyMission')}</Title>
      {earn.weekly?<>
        <Copy muted>{earn.weekly.periodStart} — {addTaskDays(earn.weekly.periodStart,6)}</Copy>
        <WeeklyProgress mission={earn.weekly}/>
        <Copy>{t('earned')} · {earn.weekly.awardedPoints} / {earn.weekly.weeklyBonusPoints} {t('pointsUnit')}</Copy>
        <Copy muted>{t('deadline')} · {formatTime(earn.weekly.cutoffAt)}</Copy><Copy muted>{t('rule')} · {earn.weekly.ruleVersion}</Copy>
      </>:<Copy muted>{t('notInstanced')}</Copy>}
      <Copy muted>{t('gentle')}</Copy>
    </Card>
    <Card>
      <Title>{t('syncHistory')}</Title><Copy muted>{t('syncHistoryHelp')}</Copy>
      {[s.today,addTaskDays(s.today,-1)].map(date=>{
        const day=s.days.find(item=>item.date===date);const pending=s.pendingDates.includes(date);
        return <Button key={date} secondary label={`${date} · ${pending?t('retryPending'):t('syncDay')}`} disabled={!s.cloudReady||s.releaseState.policy!=='verified'||(!pending&&(!day?.observedAt||!day.steps.pin||day.steps.eligible.status!=='present'))} busy={s.busy} onPress={()=>s.syncDate(date)}/>;
      })}
      {!s.cloudReady&&<Copy muted>{t('syncDisabled')}</Copy>}
      {s.releaseState.policy!=='verified'&&<Copy muted>{t('releaseUnavailable')}</Copy>}
    </Card>
    {history.length>0&&<Card><Title>{t('previousMissions')}</Title>{history.map(mission=><View key={mission.id} style={{gap:8,paddingVertical:10}}>
      <Copy large>{mission.kind==='daily_steps'?t('dailyMission'):t('weeklyMission')} · {mission.periodStart}</Copy>
      <Copy>{t('earned')} · {mission.awardedPoints} {t('pointsUnit')}</Copy>
      {mission.pendingReview&&<Status label={t('pendingMission')} tone="warning"/>}
      <Copy muted>{t('deadline')} · {formatTime(mission.cutoffAt)}</Copy><Copy muted>{t('rule')} · {mission.ruleVersion}</Copy>
    </View>)}</Card>}
    {s.missionSnapshot&&<Copy muted>{t('missionSnapshot')} · {formatTime(s.missionSnapshot.serverNow)}</Copy>}
    <Button secondary label={t('refreshMissions')} onPress={s.reload} disabled={s.connection!=='online'} busy={s.busy}/>
  </>;
}
