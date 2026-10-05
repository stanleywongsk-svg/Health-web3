import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { createRuntime, type Runtime } from './services/runtime';
import { useHealthLoop } from './services/use-healthloop';
import { Consents, Home, Login, Missions, Points, Profile } from './screens/main';
import { Button, Card, Copy, Status, Title } from './components/ui';
import { t } from './i18n';
import { theme } from './theme';
import type { AppTab, Navigate, ProfileSection } from './utils/earn-view';

const tabs = [{key:'home',glyph:'◉'},{key:'missions',glyph:'✓'},{key:'points',glyph:'◇'},{key:'profile',glyph:'○'}] as const;
function SignedInContent({state}:{state:ReturnType<typeof useHealthLoop>}) {
  const [tab,setTab]=useState<AppTab>('home');
  const [profileSection,setProfileSection]=useState<ProfileSection>('menu');
  const navigate:Navigate=(next,section='menu')=>{setTab(next);setProfileSection(section)};
  const ready=!!state.session&&state.consented;
  return <>
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView key={tab} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!!state.message&&<View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}><Copy>{state.message}</Copy></View>}
        {state.session&&state.connection==='offline'&&<Card tint><Title>{t('offlineLocal')}</Title><Copy>{state.consented?t('offlineLocalBody'):t('offlineUnconfirmed')}</Copy><Button secondary label={t('reconnect')} onPress={state.reconnect} busy={state.busy}/></Card>}
        {state.session&&state.connection==='verifying'&&<Copy muted>{t('verifyingConsent')}</Copy>}
        {state.session&&state.consented&&!state.loading&&state.connection==='online'&&['unavailable','mismatch'].includes(state.releaseState.policy)&&<Card><Title>{t('releaseCheckTitle')}</Title><Copy>{t(state.releaseState.policy==='mismatch'?'releaseMismatch':'releaseUnavailable')}</Copy><Button secondary label={t('refreshRelease')} onPress={state.reload} busy={state.busy}/></Card>}
        {state.loading?<View style={{padding:40,gap:20}}><ActivityIndicator color={theme.primary}/><Copy>{t('load')}</Copy></View>
          :!state.session?<Login state={state}/>
          :state.connection==='blocked'?<Card><Title>{t('accessBlocked')}</Title><Copy>{t('accessBlockedBody')}</Copy><Button label={t('reconnect')} onPress={state.reconnect} busy={state.busy}/><Button secondary label={t('logout')} onPress={state.logout} busy={state.busy}/></Card>
          :!state.consented?<Consents state={state}/>
          :tab==='home'?<Home state={state} navigate={navigate}/>
          :tab==='missions'?<Missions state={state} navigate={navigate}/>
          :tab==='points'?<Points state={state} navigate={navigate}/>
          :<Profile key={profileSection} state={state} initialSection={profileSection}/>}
      </ScrollView>
    </KeyboardAvoidingView>
    {ready&&<View style={styles.nav} accessibilityRole="tablist">{tabs.map(item=><Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={t(item.key)} accessibilityState={{selected:tab===item.key}} onPress={()=>navigate(item.key)} style={[styles.tab,tab===item.key&&styles.selected]}>
      <Text accessible={false} style={[styles.tabGlyph,tab===item.key&&styles.activeText]}>{item.glyph}</Text><Text style={[styles.tabLabel,tab===item.key&&styles.activeText]}>{t(item.key)}</Text>
    </Pressable>)}</View>}
  </>;
}
function Application({runtime}:{runtime:Runtime}) {
  const state=useHealthLoop(runtime);
  return <SafeAreaView style={styles.container}><StatusBar style="dark"/>
    <View style={styles.header}><View style={{flex:1,gap:4}}><Text style={styles.wordmark}>{t('brand')}</Text><Text style={styles.eyebrow}>{t('eyebrow')}</Text></View>
      {state.session&&<Status label={t(state.connection==='online'?'connectionOnline':state.connection==='offline'?'connectionOffline':'connectionVerifying')} tone={state.connection==='online'?'positive':'neutral'}/>}
    </View>
    <SignedInContent key={state.session?.user.id??'signed-out'} state={state}/>
  </SafeAreaView>;
}
export default function App() {
  const runtime=useMemo(()=>{try{return createRuntime()}catch{return null}},[]);
  return <SafeAreaProvider>{runtime?<Application runtime={runtime}/>:<SafeAreaView style={styles.container}><View style={styles.content}><Card><Title>{t('configTitle')}</Title><Copy>{t('configBody')}</Copy></Card></View></SafeAreaView>}</SafeAreaProvider>;
}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:theme.bg},header:{paddingHorizontal:22,paddingVertical:16,flexDirection:'row',gap:12,alignItems:'center'},wordmark:{fontSize:21,fontWeight:'700',color:theme.ink,letterSpacing:1.5},eyebrow:{fontSize:10,lineHeight:16,letterSpacing:.5,color:theme.muted},content:{padding:20,paddingTop:8,paddingBottom:32,gap:20},notice:{padding:16,borderRadius:16,backgroundColor:'#FFF1D9',borderColor:'#EFDCB7',borderWidth:1},nav:{flexDirection:'row',gap:4,paddingHorizontal:12,paddingTop:8,paddingBottom:5,backgroundColor:'#fff',borderTopColor:theme.line,borderTopWidth:1},tab:{flex:1,alignItems:'center',paddingVertical:8,paddingHorizontal:3,borderRadius:16,gap:4,minHeight:62},selected:{backgroundColor:theme.pale},tabGlyph:{color:theme.muted,fontSize:23,lineHeight:27},tabLabel:{color:theme.muted,fontSize:12,lineHeight:19,textAlign:'center'},activeText:{color:theme.primary,fontWeight:'700'}});
