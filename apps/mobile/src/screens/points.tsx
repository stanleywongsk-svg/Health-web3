import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { Reward } from '@healthloop/api-client';
import { Button, Card, Copy, Title } from '../components/ui';
import { t } from '../i18n';
import { theme } from '../theme';
import { formatTime, type HealthLoopState } from '../services/use-healthloop';

const rewardTitle=(reward:Reward)=>reward.titleKey==='rewards.demoBadge'?t('rewardTitle'):t('demoReward');
const delta=(value:number)=>`${value>0?'+':''}${value}`;

export function Points({state:s}:{state:HealthLoopState}) {
  const rewards=s.rewardState;
  const verified=s.connection==='online'&&s.consented;
  const working=s.busy||rewards.processing||rewards.loading;
  const confirmRedeem=(reward:Reward)=>{
    const accountId=s.session?.user.id;if(!accountId)return;
    Alert.alert(t('redeemConfirm'),t('redeemConfirmBody').replace('{points}',String(reward.pointsCost)),[
      {text:t('cancelDialog'),style:'cancel'},
      {text:t('confirmRedeem'),onPress:()=>{void s.redeemReward(reward.id,accountId)}},
    ]);
  };
  const confirmCancel=(id:string)=>{
    const accountId=s.session?.user.id;if(!accountId)return;
    Alert.alert(t('cancelRedemptionConfirm'),t('cancelRedemptionBody'),[
      {text:t('cancelDialog'),style:'cancel'},
      {text:t('confirmCancelRedemption'),style:'destructive',onPress:()=>{void s.cancelReward(id,accountId)}},
    ]);
  };
  return <>
    <Card tint>
      <Copy>{t('balance')}</Copy><Text style={styles.count}>{s.points?.availablePoints??'—'}</Text>
      <Copy muted>{t('pointsDisclaimer')}</Copy>
      <View style={styles.between}><Copy>{t('pending')} · {s.points?.pendingEvaluations??'—'}</Copy><Copy>{t('reversed')} · {s.points?.reversedPoints??'—'}</Copy></View>
      <Copy>{t('correctionTotal')} · {s.points?delta(s.points.correctionPoints):'—'}</Copy>
      {s.points&&s.points.balance<0&&<><Copy>{t('signedBalance')} · {s.points.balance}</Copy><Copy>{t('negativeBalanceHelp')}</Copy></>}
    </Card>
    <Card>
      <Title>{t('rewards')}</Title><Copy>{t('rewardsDemoNotice')}</Copy>
      {!verified&&<Copy muted>{t('reconnectRequired')}</Copy>}
      {verified&&!s.cloudReady&&<Copy muted>{t('rewardConsentNeeded')}</Copy>}
      {verified&&!rewards.ready&&!working&&<Copy muted>{t('rewardRefreshNeeded')}</Copy>}
      {rewards.pending&&<View style={styles.notice}>
        <Copy large>{t('rewardPending')}</Copy>
        <Copy>{rewards.pending.stage==='refresh'?t('rewardRefreshPending'):t('rewardPendingBody')}</Copy>
        <Button secondary label={t('retryReward')} onPress={s.retryReward} disabled={!verified} busy={working}/>
      </View>}
      {rewards.rewards.length?rewards.rewards.map(reward=>{
        const affordable=!!s.points&&s.points.availablePoints>=reward.pointsCost;
        return <View key={reward.id} style={styles.item}>
          <Copy large>{rewardTitle(reward)}</Copy>
          <Copy>{t('rewardCost')} · {reward.pointsCost} {t('pointsUnit')}</Copy>
          <Copy muted>{t('rewardStock')} · {reward.stock}</Copy>
          {!affordable&&<Copy muted>{t('insufficientPoints')}</Copy>}
          {reward.stock<1&&<Copy muted>{t('outOfStock')}</Copy>}
          <Button label={t('redeem')} onPress={()=>confirmRedeem(reward)} disabled={!verified||!s.cloudReady||!rewards.ready||!!rewards.pending||!affordable||reward.stock<1||!reward.isDemo} busy={working}/>
        </View>;
      }):<Copy muted>{t('rewardsEmpty')}</Copy>}
    </Card>
    <Card>
      <Title>{t('redemptionHistory')}</Title><Copy muted>{t('refundAvailableWithoutConsent')}</Copy>
      {rewards.redemptions.items.length?rewards.redemptions.items.map(record=><View key={record.id} style={styles.item}>
        <Copy large>{record.status==='cancelled'?t('cancelledStatus'):t('demonstrationStatus')}</Copy>
        <Copy>{record.pointsCost} {t('pointsUnit')} · {formatTime(record.createdAt)}</Copy>
        {record.status==='demonstration'&&<>
          <Copy muted>{t('demoCodeLabel')}</Copy><Text selectable style={styles.code}>{record.demoCode}</Text>
          <Button secondary label={t('cancelRedemption')} onPress={()=>confirmCancel(record.id)} disabled={!verified||!rewards.ready||rewards.pending?.kind==='cancel'} busy={working}/>
        </>}
      </View>):<Copy muted>{t('redemptionEmpty')}</Copy>}
      {rewards.redemptions.nextCursor&&<Button secondary label={t('more')} onPress={s.loadMoreRedemptions} disabled={!verified} busy={working}/>}
    </Card>
    <Card>
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
    </Card>
    <Button secondary label={t('refresh')} onPress={s.reload} disabled={!verified} busy={working}/>
  </>;
}
const styles=StyleSheet.create({count:{fontSize:62,lineHeight:78,fontWeight:'700',color:theme.ink,fontVariant:['tabular-nums']},between:{flexDirection:'row',gap:12,flexWrap:'wrap'},item:{gap:12,paddingTop:16,borderTopWidth:1,borderColor:theme.line},notice:{gap:12,padding:16,borderRadius:16,backgroundColor:theme.pale},code:{fontSize:16,lineHeight:24,color:theme.ink},ledgerRow:{flexDirection:'row',gap:14,paddingVertical:12,borderBottomWidth:1,borderColor:theme.line},detail:{flex:1,gap:4}});
