import React from 'react';
import { View } from 'react-native';
import { Button, Card, Copy, Title } from '../components/ui';
import { t } from '../i18n';
import { formatTime, type HealthLoopState } from '../services/use-healthloop';

export function Appeals({state:s}:{state:HealthLoopState}) {
  return <Card><Title>{t('ownAppeals')}</Title>
    {s.appeals.items.length?s.appeals.items.map(appeal=><View key={appeal.id} style={{gap:12,paddingVertical:8}}>
      <Copy large>{appeal.taskDate} · {appeal.status==='resolved'?t('appealResolved'):t('appealOpen')}</Copy>
      <Copy muted>{formatTime(appeal.createdAt)}</Copy><Copy>{t('appealReason')} · {appeal.reason}</Copy>
      {appeal.proposals.map(proposal=><View key={proposal.id} style={{gap:6}}>
        <Copy>{proposal.status==='approved'?t('proposalApproved'):proposal.status==='rejected'?t('proposalRejected'):t('proposalPending')}</Copy>
        <Copy muted>{t('correctionReference')} · {proposal.id}</Copy>
        <Copy>{t('proposalReason')} · {proposal.proposalReason}</Copy>
        {proposal.decisionReason&&<Copy>{t('decisionReason')} · {proposal.decisionReason}</Copy>}
        {proposal.decidedAt&&<Copy muted>{formatTime(proposal.decidedAt)}</Copy>}
      </View>)}
    </View>):<Copy muted>{t('appealsEmpty')}</Copy>}
    {s.appeals.nextCursor&&<Button secondary label={t('more')} onPress={s.loadMoreAppeals} disabled={s.connection!=='online'} busy={s.busy}/>}
  </Card>;
}
