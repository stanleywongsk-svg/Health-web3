import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import type { MetricResult } from '@healthloop/health-provider';
import { Button, Card, Copy, PageHeading, Progress, Stat, Status, Title } from '../components/ui';
import { currentEarn, EarnActionButton, WeeklyProgress } from '../components/earn';
import { t, tx, type TranslationKey } from '../i18n';
import { formatTime, type HealthLoopState } from '../services/use-healthloop';
import type { Navigate } from '../utils/earn-view';
import { theme } from '../theme';

const metricMessage=(metric:MetricResult<unknown>|undefined,empty:TranslationKey='noData')=>metric?.status==='invalid'?t('invalidData'):metric?.status==='error'?t('queryError'):metric?.status==='unavailable'?t('unavailable'):t(empty);
export function Home({state:s,navigate}:{state:HealthLoopState;navigate:Navigate}) {
  const today=s.days.find(day=>day.date===s.today);
  const displayed=today?.steps.displayed;
  const earn=currentEarn(s);
  const settings=()=>Alert.alert(t('healthSettings'),t('settingsBody'),[{text:t('dismiss')},{text:t('settingsOpen'),onPress:()=>void Linking.openSettings().catch(()=>Alert.alert(t('error')))}]);
  return <>
    <PageHeading kicker={`${s.today} · ${t('greetingDate')}`} title={t('tagline')}/>
    <Card tint>
      <View style={styles.between}><Copy>{t('today')}</Copy><Status label={t('earnKicker')} tone="positive"/></View>
      <View style={styles.countRow}><Text selectable accessibilityLabel={`${t('today')} ${displayed?.status==='present'?displayed.value:t('noData')}`} style={styles.count}>{displayed?.status==='present'?displayed.value.toLocaleString('zh-CN'):'—'}</Text><Copy>{t('steps')}</Copy></View>
      <Copy>{t('availableSteps')} · {earn.steps===null?t('noData'):earn.steps.toLocaleString('zh-CN')}</Copy>
      <Progress label={t('goal')} value={earn.fraction}/>
      <View style={styles.between}><Copy>{t('goal')}</Copy><Copy>{earn.goal===null?'—':`${earn.goal.toLocaleString('zh-CN')} ${t('steps')}`}</Copy></View>
      <Copy muted>{earn.fraction===null?t('progressUnknown'):earn.fraction>=1?t('progressGoal'):t('gentle')}</Copy>
      <View style={styles.stats}>
        <Stat label={t('postedToday')} value={earn.daily?`${earn.daily.awardedPoints} ${t('pointsUnit')}`:'—'}/>
        <Stat label={t('previewPoints')} value={earn.preview===null?'—':`${earn.preview} ${t('pointsUnit')}`}/>
      </View>
      <Copy muted>{t('previewHelp')}</Copy>
      <EarnActionButton state={s} navigate={navigate}/>
    </Card>
    <Card>
      <View style={styles.between}><Title>{t('earnOverview')}</Title><Status label={t('pointsUnit')}/></View>
      <View style={styles.stats}><Stat label={t('balance')} value={s.points?.availablePoints??'—'}/><Stat label={t('pending')} value={s.points?.pendingEvaluations??'—'}/></View>
      <Button secondary label={t('viewPoints')} onPress={()=>navigate('points')}/>
    </Card>
    <Card>
      <Title>{t('weeklyMission')}</Title>
      {earn.weekly?<WeeklyProgress mission={earn.weekly}/>:<Copy muted>{t('notInstanced')}</Copy>}
      <Button secondary label={t('viewMissions')} onPress={()=>navigate('missions')}/>
    </Card>
    <Card>
      <Title>{t('healthDataTitle')}</Title><Copy muted>{t('healthDataBody')}</Copy>
      <Copy>{t('source')} · {today?.steps.pin?.sourceCategory==='apple_watch'?t('sourceWatch'):today?.steps.pin?.sourceCategory==='apple_phone'?t('sourcePhone'):t('sourceNone')}</Copy>
      <Copy muted>{t('updated')} · {s.updated?formatTime(s.updated):t('notUpdated')}</Copy>
      {!displayed||displayed.status!=='present'?<><Status label={t('dataUnavailableTitle')}/><Copy>{displayed?.status==='no_data'||!displayed?t('unknownRead'):metricMessage(displayed)}</Copy></>:<Copy muted>{t('stale')}</Copy>}
      <Button secondary label={s.updated?t('readActivity'):t('requestAccess')} onPress={()=>s.refreshHealth(!s.updated)} disabled={!s.localAllowed} busy={s.busy}/>
      {!s.localAllowed&&<Copy muted>{t('earnConsent')}</Copy>}
      <Button secondary label={t('healthSettings')} onPress={settings}/>
      <Copy muted>{t('policyHelp')}</Copy>
    </Card>
    <Card>
      <Title>{t('history')}</Title><Copy muted>{t('historyLocal')}</Copy>
      {s.days.length?s.days.map(day=><View key={day.date} style={styles.historyRow}>
        <View style={styles.between}><Copy>{day.date.slice(5)}</Copy><Copy>{day.steps.displayed.status==='present'?`${day.steps.displayed.value.toLocaleString('zh-CN')} ${t('steps')}`:t('noData')}</Copy></View>
        <Progress label={`${day.date} · ${t('steps')}`} value={day.steps.displayed.status==='present'?day.steps.displayed.value/7000:null}/>
      </View>):<Copy muted>{t('noData')}</Copy>}
    </Card>
    <Card>
      <Title>{t('optional')}</Title><Copy large>{t('sleep')}</Copy><Copy muted>{t('sleepHelp')}</Copy>
      {s.sleepSources.length>0&&<Copy muted>{t('source')} · {s.sleepSources.join('、')}</Copy>}
      {s.sleep.status==='present'?<><Copy>{Math.round(s.sleep.value.durationMinutes)} {t('minutes')}</Copy>{s.sleep.value.intervals.map(interval=><Copy key={interval.startAt}>{formatTime(interval.startAt)} – {formatTime(interval.endAt)}</Copy>)}</>:<Copy>{metricMessage(s.sleep,'noSleep')}</Copy>}
      <Button secondary label={t('sleepRequest')} onPress={()=>s.optionalRead('sleep')} disabled={!s.localAllowed} busy={s.busy}/>
      <Copy large>{t('heart')}</Copy><Copy muted>{t('heartHelp')}</Copy>
      {s.heartSources.length>0&&<Copy muted>{t('source')} · {s.heartSources.join('、')}</Copy>}
      {s.heart.status==='present'?<><Copy large>{Math.round(s.heart.value.beatsPerMinute)} {t('bpm')}</Copy><Copy muted>{formatTime(s.heart.value.measuredAt)}</Copy></>:<Copy>{metricMessage(s.heart,'noHeart')}</Copy>}
      <Button secondary label={t('heartRequest')} onPress={()=>s.optionalRead('heart_rate')} disabled={!s.localAllowed} busy={s.busy}/>
    </Card>
    {earn.nextTier&&<Copy muted>{tx('nextTier',{steps:(earn.nextTier.steps-(earn.steps??0)).toLocaleString('zh-CN')})} · {t('nextTierHelp')}</Copy>}
    <Copy muted>{t('pointsDisclaimer')}</Copy>
  </>;
}
const styles=StyleSheet.create({between:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'},countRow:{flexDirection:'row',alignItems:'baseline',gap:8,flexWrap:'wrap'},count:{maxWidth:'100%',flexShrink:1,fontSize:58,lineHeight:72,fontWeight:'700',letterSpacing:-2,color:theme.ink,fontVariant:['tabular-nums']},stats:{flexDirection:'row',flexWrap:'wrap',gap:18,paddingTop:6},historyRow:{gap:9,paddingVertical:4}});
