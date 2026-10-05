import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme } from '../theme';

export function Copy({children,muted=false,large=false}:{children:React.ReactNode;muted?:boolean;large?:boolean}) {
  return <Text selectable style={[styles.copy,muted&&styles.muted,large&&styles.large]}>{children}</Text>;
}
export function Card({children,tint=false}:{children:React.ReactNode;tint?:boolean}) {
  return <View style={[styles.card,tint&&styles.tint]}>{children}</View>;
}
export function Title({children}:{children:React.ReactNode}) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
}
export function PageHeading({title,body,kicker}:{title:string;body?:string;kicker?:string}) {
  return <View style={{gap:8}}>{kicker&&<Text style={styles.kicker}>{kicker}</Text>}<Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>{body&&<Copy muted>{body}</Copy>}</View>;
}
export function Button({label,onPress,disabled=false,secondary=false,busy=false,danger=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean;busy?:boolean;danger?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.secondary,danger&&styles.danger,(disabled||busy)&&styles.disabled,pressed&&{opacity:.75}]}>
    {busy&&<ActivityIndicator color={secondary?theme.primary:'#fff'}/>}
    <Text style={[styles.buttonText,secondary&&{color:theme.primary}]}>{label}</Text>
  </Pressable>;
}
export function Toggle({label,help,value,onChange}:{label:string;help:string;value:boolean;onChange:(value:boolean)=>void}) {
  return <View style={styles.toggle}><View style={{flex:1,gap:5}}><Copy>{label}</Copy><Copy muted>{help}</Copy></View><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{true:theme.primary,false:theme.line}}/></View>;
}
export function Input(props:TextInputProps) {
  return <TextInput placeholderTextColor={theme.muted} {...props} style={[styles.input,props.style]}/>;
}
export function Progress({value,label}:{value:number|null;label:string}) {
  const progress=value===null?null:Math.round(Math.max(0,Math.min(1,value))*100);
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={progress===null?{text:'—'}:{min:0,max:100,now:progress}} style={styles.progress}>
    {progress!==null&&<View style={[styles.fill,{width:`${progress}%`}]}/>}
  </View>;
}
export function Status({label,tone='neutral'}:{label:string;tone?:'neutral'|'positive'|'warning'}) {
  return <View style={[styles.status,tone==='positive'&&styles.positive,tone==='warning'&&styles.warning]}><Text style={[styles.statusText,tone==='positive'&&{color:theme.primary},tone==='warning'&&{color:theme.warning}]}>{label}</Text></View>;
}
export function Stat({label,value,help}:{label:string;value:string|number;help?:string}) {
  return <View style={styles.stat}><Copy muted>{label}</Copy><Text selectable style={styles.statValue}>{value}</Text>{help&&<Copy muted>{help}</Copy>}</View>;
}
export function ActionRow({label,detail,onPress}:{label:string;detail:string;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail} onPress={onPress} style={({pressed})=>[styles.actionRow,pressed&&{backgroundColor:theme.pale}]}>
    <View style={{flex:1,gap:5}}><Text style={[styles.copy,styles.large]}>{label}</Text><Text style={[styles.copy,styles.muted]}>{detail}</Text></View><Text accessible={false} style={styles.chevron}>›</Text>
  </Pressable>;
}
const styles=StyleSheet.create({
  copy:{fontSize:15,lineHeight:23,color:theme.ink},muted:{color:theme.muted},large:{fontSize:18,lineHeight:28},
  title:{fontSize:22,lineHeight:31,fontWeight:'700',color:theme.ink},pageTitle:{fontSize:32,lineHeight:42,fontWeight:'700',letterSpacing:-.6,color:theme.ink},kicker:{fontSize:12,lineHeight:19,fontWeight:'600',letterSpacing:1,color:theme.primary},
  card:{backgroundColor:theme.card,borderRadius:24,borderCurve:'continuous',padding:20,gap:16,borderColor:theme.line,borderWidth:1},tint:{backgroundColor:theme.pale,borderColor:'#D0E7DC'},
  button:{minHeight:52,padding:14,borderRadius:16,flexDirection:'row',gap:10,alignItems:'center',justifyContent:'center',backgroundColor:theme.primary},secondary:{backgroundColor:theme.pale},danger:{backgroundColor:theme.danger},disabled:{opacity:.55},buttonText:{flexShrink:1,fontSize:16,lineHeight:24,fontWeight:'600',color:'#fff',textAlign:'center'},
  toggle:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8},input:{borderWidth:1,borderColor:theme.line,borderRadius:14,minHeight:52,padding:14,fontSize:16,color:theme.ink,backgroundColor:'#fff'},
  progress:{height:9,borderRadius:9,backgroundColor:'#D4E6DF',overflow:'hidden'},fill:{height:'100%',backgroundColor:theme.primary,borderRadius:9},
  status:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:theme.bg},positive:{backgroundColor:'#DAEDE3'},warning:{backgroundColor:'#FFF0D5'},statusText:{fontSize:12,lineHeight:18,fontWeight:'600',color:theme.muted},
  stat:{minWidth:110,flex:1,gap:6},statValue:{fontSize:29,lineHeight:38,fontWeight:'700',fontVariant:['tabular-nums'],color:theme.ink},
  actionRow:{minHeight:64,flexDirection:'row',alignItems:'center',gap:14,paddingVertical:14,borderBottomWidth:1,borderColor:theme.line},chevron:{fontSize:26,color:theme.muted},
});
