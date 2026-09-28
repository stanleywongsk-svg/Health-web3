import React from 'react';
import { Linking, View } from 'react-native';
import { Button, Card, Copy, Input, Title, Toggle } from '../components/ui';
import { t } from '../i18n';
import { errorMessage } from '../utils/error-message';
import type { HealthLoopState } from '../services/use-healthloop';

export function Reminders({state:s}:{state:HealthLoopState}){
  const reminder=s.reminderState;
  const online=s.connection==='online'&&s.consented;
  const busy=s.busy||reminder.busy;
  const status=reminder.schedule==='scheduled'?'reminderScheduled':reminder.schedule==='blocked'?'reminderBlocked':reminder.schedule==='error'?'reminderScheduleError':'reminderOff';
  return <Card>
    <Title>{t('preferences')}</Title><Copy muted>{t('notifyHelp')}</Copy>
    <Toggle label={t('reminderToggle')} help={t('reminderToggleHelp')} value={reminder.draft.enabled} onChange={enabled=>s.changeReminder({enabled})}/>
    <Copy>{t(status)}{reminder.schedule==='scheduled'&&reminder.saved?` · ${reminder.saved.reminderTime}`:''}</Copy>
    {reminder.errorCode&&<View accessibilityRole="alert"><Copy>{errorMessage({code:reminder.errorCode},t('reminderScheduleError'))}</Copy></View>}
    {!reminder.ready&&<Copy muted>{t('reminderRefreshNeeded')}</Copy>}
    {reminder.dirty&&<Copy muted>{t('reminderDraft')}</Copy>}
    {reminder.saved?.enabled&&!reminder.draft.enabled&&reminder.schedule==='off'&&<Copy muted>{t('reminderPendingServer')}</Copy>}
    <Copy muted>{t('reminderTimezone')}</Copy>
    {(['reminderTime','quietStart','quietEnd'] as const).map(field=><View key={field} style={{gap:6}}>
      <Copy>{t(field)}</Copy>
      <Input accessibilityLabel={t(field)} placeholder="HH:mm" value={reminder.draft[field]} onChangeText={value=>s.changeReminder({[field]:value})} editable={!busy} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={5}/>
    </View>)}
    <Copy muted>{t('reminderTimeHelp')}</Copy>
    <Button label={t('reminderSave')} onPress={s.saveReminder} disabled={!online||!reminder.ready} busy={busy}/>
    <Button secondary label={t('reminderReload')} onPress={s.reloadReminder} disabled={!online} busy={busy}/>
    <Button secondary label={t('reminderSettings')} onPress={()=>void Linking.openSettings().catch(s.reminderSettingsFailed)}/>
  </Card>;
}
