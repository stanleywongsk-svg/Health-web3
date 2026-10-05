import React, { useState } from 'react';
import { View } from 'react-native';
import { ActionRow, Button, Card, Copy, Input, PageHeading, Status, Title } from '../components/ui';
import { Consents } from './onboarding';
import { Reminders } from './reminders';
import { Appeals } from './appeals';
import type { ProfileSection } from '../utils/earn-view';
import { t } from '../i18n';
import { taskDate, type HealthLoopState } from '../services/use-healthloop';

export function Profile({state:s,initialSection='menu'}:{state:HealthLoopState;initialSection?:ProfileSection}) {
  const [section,setSection]=useState<ProfileSection>(initialSection);
  const [reason,setReason]=useState('');const [date,setDate]=useState(taskDate);const [deletionCode,setDeletionCode]=useState('');
  const back=<Button secondary label={t('backProfile')} onPress={()=>setSection('menu')}/>;
  if(section==='privacy')return <>{back}<Consents state={s}/></>;
  if(section==='reminders')return <>{back}<Reminders state={s}/></>;
  if(section==='corrections')return <>{back}<PageHeading title={t('correctionsSection')}/><Card>
    <Title>{t('correction')}</Title><Copy muted>{t('correctionHelp')}</Copy>
    <Input accessibilityLabel={t('taskDateLabel')} placeholder={t('taskDatePlaceholder')} value={date} onChangeText={setDate} maxLength={10}/>
    <Input multiline accessibilityLabel={t('correction')} placeholder={t('correctionPlaceholder')} value={reason} onChangeText={setReason} maxLength={1000}/>
    <Button secondary label={t('submitCorrection')} onPress={()=>s.appeal(reason,date)} disabled={s.connection!=='online'||reason.trim().length<10} busy={s.busy}/>
  </Card><Appeals state={s}/></>;
  if(section==='data')return <>{back}<PageHeading title={t('dataSection')}/><Card>
    <Title>{t('export')}</Title><Copy muted>{t('exportHelp')}</Copy><Button secondary label={t('export')} onPress={s.exportData} disabled={s.connection!=='online'} busy={s.busy}/>
  </Card><Card>
    <Title>{t('delete')}</Title><Copy muted>{t('deleteHelp')}</Copy><Button secondary label={t('deleteSend')} onPress={()=>s.sendCode(s.session?.user.email??'')} disabled={s.connection!=='online'} busy={s.busy}/>
    <Input accessibilityLabel={t('code')} placeholder={t('codePlaceholder')} keyboardType="number-pad" value={deletionCode} onChangeText={setDeletionCode} maxLength={10}/>
    <Button danger label={t('deleteConfirm')} onPress={()=>s.deleteAccount(deletionCode)} disabled={s.connection!=='online'||deletionCode.length<6} busy={s.busy}/>
  </Card></>;
  if(section==='about')return <>{back}<PageHeading title={t('aboutSection')}/>
    <Card><Title>{t('pointRulesTitle')}</Title><Copy>{t('pointRulesBody')}</Copy><Copy>{t('badgesHelp')}</Copy><Copy muted>{t('badgeCorrections')}</Copy><Copy muted>{t('pointsDisclaimer')}</Copy></Card>
    <Card><Title>{t('releaseScopeTitle')}</Title><Copy>{t('releaseScopeBody')}</Copy></Card>
    <Card><Title>{t('help')}</Title><Copy>{t('helpBody')}</Copy><Copy muted>{t('privacyBody')}</Copy>
      <Button secondary label={t('privacySection')} onPress={()=>setSection('privacy')}/>
      <Button secondary label={t('correctionsSection')} onPress={()=>setSection('corrections')}/>
      <Button secondary label={t('dataSection')} onPress={()=>setSection('data')}/>
    </Card></>;
  return <>
    <PageHeading title={t('profileTitle')}/>
    <Card tint><Title>{t('account')}</Title><Copy>{s.session?.user.email}</Copy><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      <Status label={`${t('localRead')} · ${t(s.localAllowed?'enabled':'disabled')}`} tone={s.localAllowed?'positive':'neutral'}/>
      <Status label={`${t('cloudSync')} · ${t(s.cloudReady?'enabled':'disabled')}`} tone={s.cloudReady?'positive':'neutral'}/>
    </View><Copy muted>{t('gentle')}</Copy></Card>
    <Card><Title>{t('accountSection')}</Title>
      <ActionRow label={t('privacySection')} detail={t('privacySectionHelp')} onPress={()=>setSection('privacy')}/>
      <ActionRow label={t('preferences')} detail={t('remindersSectionHelp')} onPress={()=>setSection('reminders')}/>
      <ActionRow label={t('correctionsSection')} detail={t('correctionsSectionHelp')} onPress={()=>setSection('corrections')}/>
      <ActionRow label={t('dataSection')} detail={t('dataSectionHelp')} onPress={()=>setSection('data')}/>
      <ActionRow label={t('aboutSection')} detail={t('aboutSectionHelp')} onPress={()=>setSection('about')}/>
    </Card>
    <Button secondary label={t('logout')} onPress={s.logout} busy={s.busy}/>
    <Copy muted>{t('pointsDisclaimer')}</Copy>
  </>;
}
