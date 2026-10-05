import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Copy, PageHeading, Stat, Status, Title } from '../components/ui';
import { t } from '../i18n';
import type { Navigate } from '../utils/earn-view';
import { theme } from '../theme';
import { formatTime, type HealthLoopState } from '../services/use-healthloop';

const delta=(value:number)=>`${value>0?'+':''}${value}`;

export function Points({state:s,navigate}:{state:HealthLoopState;navigate:Navigate}) {
  const [section,setSection]=useState<'rewardsTab'|'ledgerTab'|'recordsTab'>('rewardsTab');
  const rewards=s.rewardState;
  const gallery=s.releaseState;
  const verified=s.connection==='online'&&s.consented;
  const working=s.busy||rewards.processing||rewards.loading;
  const confirmCancel=(id:string)=>{
    const accountId=s.session?.user.id;if(!accountId)return;
    Alert.alert(t('cancelRedemptionConfirm'),t('cancelRedemptionBody'),[
      {text:t('cancelDialog'),style:'cancel'},
      {text:t('confirmCancelRedemption'),style:'destructive',onPress:()=>{void s.cancelReward(id,accountId)}},
    ]);
  };
  return <>
    <PageHeading kicker={t('points')} title={t('rewardPageTitle')}/>
    <Card tint>
      <Copy>{t('balance')}</Copy><Text selectable style={styles.count}>{s.points?.availablePoints??'—'}<Text style={styles.unit}> {t('pointsUnit')}</Text></Text>
      <Copy muted>{t('availableHelp')}</Copy><Copy muted>{t('pointsDisclaimer')}</Copy>
      <View style={styles.between}><Stat label={t('lifetimeEarned')} value={s.points?.earnedPoints??'—'}/><Stat label={t('pending')} value={s.points?.pendingEvaluations??'—'}/></View>
      <Copy muted>{t('reversed')} · {s.points?.reversedPoints??'—'}</Copy>
      <Copy>{t('correctionTotal')} · {s.points?delta(s.points.correctionPoints):'—'}</Copy>
      {s.points&&s.points.balance<0&&<><Copy>{t('signedBalance')} · {s.points.balance}</Copy><Copy>{t('negativeBalanceHelp')}</Copy></>}
    </Card>
    {rewards.pending&&<Card>
      <Title>{t('rewardPending')}</Title>
      <Copy>{rewards.pending.stage==='refresh'?t('rewardRefreshPending'):t('rewardPendingBody')}</Copy>
      <Button secondary label={t('retryReward')} onPress={s.retryReward} disabled={!verified} busy={working}/>
    </Card>}
    <View style={styles.sections} accessibilityRole="tablist">{(['rewardsTab','ledgerTab','recordsTab'] as const).map(key=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:section===key}} onPress={()=>setSection(key)} style={[styles.section,section===key&&styles.selected]}><Text style={[styles.sectionText,section===key&&{color:theme.primary,fontWeight:'700'}]}>{t(key)}</Text></Pressable>)}</View>
    {section==='rewardsTab'&&<Card>
      <Title>{t('rewards')}</Title><Copy>{t('badgesHelp')}</Copy>
      {gallery.policy==='mismatch'?<Copy>{t('releaseMismatch')}</Copy>
        :!verified?<Copy muted>{t('badgesOffline')}</Copy>
        :gallery.badgeStatus==='loading'?<Copy muted>{t('badgesLoading')}</Copy>
        :gallery.badgeStatus!=='ready'||!gallery.badges?<Copy muted>{t('badgesUnavailable')}</Copy>
        :<>{gallery.badges.items.map(badge=><View key={badge.id} style={styles.item}>
          <Status label={t(badge.earned?'badgeEarned':'badgeNotEarned')} tone={badge.earned?'positive':'neutral'}/>
          <Copy large>{t(badge.id==='first_steps'?'firstStepsBadge':'consistentWeekBadge')}</Copy>
          <Copy muted>{t(badge.id==='first_steps'?'firstStepsBadgeRule':'consistentWeekBadgeRule')}</Copy>
          {badge.earned&&badge.earnedOn&&<Copy>{t('badgeEarnedOn')} · {badge.earnedOn}</Copy>}
        </View>)}<Copy muted>{t('badgesEvaluatedAt')} · {formatTime(gallery.badges.evaluatedAt)}</Copy></>}
      <Copy muted>{t('badgeCorrections')}</Copy>
      <Button secondary label={t('viewMissions')} onPress={()=>navigate('missions')}/>
      <Button secondary label={t('aboutSection')} onPress={()=>navigate('profile','about')}/>
    </Card>}
    {section==='recordsTab'&&<Card>
      <Title>{t('redemptionHistory')}</Title><Copy muted>{t('legacyRecordsHelp')}</Copy><Copy muted>{t('refundAvailableWithoutConsent')}</Copy>
      {rewards.redemptions.items.length?rewards.redemptions.items.map(record=><View key={record.id} style={styles.item}>
        <Copy large>{record.status==='cancelled'?t('cancelledStatus'):t('demonstrationStatus')}</Copy>
        <Copy>{record.pointsCost} {t('pointsUnit')} · {formatTime(record.createdAt)}</Copy>
        {record.status==='demonstration'&&<>
          <Copy muted>{t('demoCodeLabel')}</Copy><Text selectable style={styles.code}>{record.demoCode}</Text>
          <Button secondary label={t('cancelRedemption')} onPress={()=>confirmCancel(record.id)} disabled={!verified||!rewards.ready||rewards.pending?.kind==='cancel'} busy={working}/>
        </>}
      </View>):<Copy muted>{t('redemptionEmpty')}</Copy>}
      {rewards.redemptions.nextCursor&&<Button secondary label={t('more')} onPress={s.loadMoreRedemptions} disabled={!verified} busy={working}/>}
    </Card>}
    {section==='ledgerTab'&&<Card>
      <Title>{t('ledger')}</Title>
      {s.ledger.items.length?s.ledger.items.map(item=>{
        const correction=item.kind==='daily_correction'||item.kind==='weekly_correction';
        const proposal=item.adjustmentId?s.appeals.items.flatMap(appeal=>appeal.proposals).find(row=>row.id===item.adjustmentId):undefined;
        const label=item.kind==='daily_correction'?t('dailyCorrection'):item.kind==='weekly_correction'?t('weeklyCorrection'):item.kind==='redemption'?t('redemption'):item.kind==='refund'?t('refund'):item.kind==='daily_award'||item.kind==='weekly_award'?t('award'):t('adjustment');
        return <View key={item.id} style={styles.ledgerRow}>
          <View style={styles.detail}><Copy>{label}</Copy><Copy muted>{formatTime(item.createdAt)}</Copy>
            {correction&&item.adjustmentId&&<Copy muted>{t('correctionReference')} · {item.adjustmentId}</Copy>}
            {proposal?<><Copy muted>{t('correctionReason')} · {proposal.proposalReason}</Copy>{proposal.decisionReason&&<Copy muted>{t('decisionReason')} · {proposal.decisionReason}</Copy>}</>:correction&&<Copy muted>{t('correctionDetailsHelp')}</Copy>}
          </View><Copy large>{delta(item.points)}</Copy>
        </View>;
      }):<Copy muted>{t('ledgerEmpty')}</Copy>}
      {s.ledger.nextCursor&&<Button secondary label={t('more')} onPress={s.loadMore} disabled={!verified} busy={working}/>}
    </Card>}
    <Button secondary label={t('refresh')} onPress={s.reload} disabled={!verified} busy={working}/>
  </>;
}
const styles=StyleSheet.create({unit:{fontSize:18,fontWeight:'400'},sections:{flexDirection:'row',flexWrap:'wrap',gap:6,padding:5,borderRadius:18,backgroundColor:'#E9EEE7'},section:{flex:1,minWidth:90,minHeight:46,paddingVertical:12,paddingHorizontal:6,borderRadius:13,alignItems:'center',justifyContent:'center'},selected:{backgroundColor:'#fff'},sectionText:{fontSize:14,lineHeight:21,textAlign:'center',color:theme.muted},count:{fontSize:62,lineHeight:78,fontWeight:'700',color:theme.ink,fontVariant:['tabular-nums']},between:{flexDirection:'row',gap:12,flexWrap:'wrap'},item:{gap:12,paddingTop:16,borderTopWidth:1,borderColor:theme.line},code:{fontSize:16,lineHeight:24,color:theme.ink},ledgerRow:{flexDirection:'row',gap:14,paddingVertical:12,borderBottomWidth:1,borderColor:theme.line},detail:{flex:1,gap:4}});
