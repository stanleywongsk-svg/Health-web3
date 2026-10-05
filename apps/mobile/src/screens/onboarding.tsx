import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Copy, Input, PageHeading, Status, Title, Toggle } from '../components/ui';
import { t } from '../i18n';
import { theme } from '../theme';
import type { HealthLoopState } from '../services/use-healthloop';

export function Login({state:s}:{state:HealthLoopState}) {
  const [email,setEmail]=useState('');const [code,setCode]=useState('');
  return <>
    <View style={styles.hero}><Status label={t('earnKicker')} tone="positive"/><PageHeading title={t('welcome')} body={t('welcomeBody')}/></View>
    <Card tint>{(['One','Two','Three'] as const).map((step,i)=><View key={step} style={styles.journeyRow}><View style={styles.step}><Text style={styles.stepText}>{i+1}</Text></View><View style={{flex:1,gap:3}}><Copy large>{t(`earnStep${step}`)}</Copy><Copy muted>{t(`earnStep${step}Body`)}</Copy></View></View>)}</Card>
    <Card>
      <Title>{t('loginTitle')}</Title><Copy muted>{t('noWalletNeeded')}</Copy>
      {s.logoutPending&&<Button secondary label={t('retryLogout')} onPress={s.logout} busy={s.busy}/>}
      <Copy>{t('email')}</Copy><Input accessibilityLabel={t('email')} placeholder={t('emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" value={email} onChangeText={setEmail}/>
      <Button label={t('sendCode')} onPress={()=>s.sendCode(email)} disabled={s.logoutPending||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} busy={s.busy}/>
      <Copy>{t('code')}</Copy><Input accessibilityLabel={t('code')} placeholder={t('codePlaceholder')} keyboardType="number-pad" textContentType="oneTimeCode" value={code} onChangeText={setCode} maxLength={10}/>
      <Button secondary label={t('verify')} onPress={()=>s.verify(email,code)} disabled={s.logoutPending||code.trim().length<6||!email.trim()} busy={s.busy}/>
    </Card>
    <Copy muted>{t('pointsDisclaimer')}</Copy>
  </>;
}
export function Consents({state:s}:{state:HealthLoopState}) {
  return <Card><Title>{t('privacyTitle')}</Title><Copy>{t('privacyBody')}</Copy><Copy>{t('privacyEarn')}</Copy><Copy muted>{t('draftConsent')}</Copy>
    <Toggle label={t('adult')} help={t('consentVersion')} value={s.adult} onChange={s.setAdult}/>
    <Toggle label={t('localRead')} help={t('localHelp')} value={s.consent.localRead} onChange={value=>s.changeConsent('localRead',value)}/>
    <Toggle label={t('cloudSync')} help={t('cloudHelp')} value={s.consent.cloudSync} onChange={value=>s.changeConsent('cloudSync',value)}/>
    <Toggle label={t('marketing')} help={t('marketingHelp')} value={s.consent.marketing} onChange={value=>s.changeConsent('marketing',value)}/>
    <Button label={t('saveConsent')} onPress={s.saveConsent} disabled={!s.adult} busy={s.busy}/>
  </Card>;
}
const styles=StyleSheet.create({hero:{paddingVertical:10,gap:16},journeyRow:{flexDirection:'row',gap:14,alignItems:'center'},step:{width:32,height:32,borderRadius:11,backgroundColor:theme.primary,alignItems:'center',justifyContent:'center'},stepText:{fontSize:15,fontWeight:'700',color:'#fff'}});
