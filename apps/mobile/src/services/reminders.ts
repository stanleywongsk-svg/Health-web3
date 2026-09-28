import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t } from '../i18n';
import type { ReminderDriver, ReminderPermission } from '../utils/reminder-controller';

// One generic, app-owned request. No account ID, health value, token or reward data.
const identifier='healthloop.daily-reminder.v1';
const permission=(status:Notifications.NotificationPermissionsStatus):ReminderPermission=>{
  if(status.ios?.status===Notifications.IosAuthorizationStatus.NOT_DETERMINED)return 'undetermined';
  if(status.ios?.status===Notifications.IosAuthorizationStatus.AUTHORIZED||status.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL)return 'granted';
  return 'denied';
};
Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
export const reminderDriver:ReminderDriver={
  permission:async()=>Platform.OS==='ios'?permission(await Notifications.getPermissionsAsync()):'unavailable',
  requestPermission:async()=>Platform.OS==='ios'?permission(await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowBadge:false,allowSound:false}})):'unavailable',
  cancel:async()=>{if(Platform.OS==='ios'){await Notifications.cancelScheduledNotificationAsync(identifier);await Notifications.dismissNotificationAsync(identifier)}},
  schedule:async choices=>{
    if(Platform.OS!=='ios')throw new Error('NOTIFICATIONS_UNAVAILABLE');
    const [hour,minute]=choices.reminderTime.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({identifier,content:{title:t('reminderTitle'),body:t('reminderBody'),sound:false},
      trigger:{type:Notifications.SchedulableTriggerInputTypes.CALENDAR,hour,minute,second:0,timezone:choices.timezone,repeats:true}});
  },
};
