import { t } from '../i18n';
export function errorMessage(error:unknown,fallback:string):string {
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  switch(code){
    case 'RELEASE_POLICY_REQUIRED':return t('releaseUnavailable');
    case 'NOT_SUPPORTED':return t('legacyRequestNotCommitted');
    case 'PREFERENCES_CONFLICT':return t('reminderConflict');
    case 'PREFERENCES_REFRESH_REQUIRED':return t('reminderRefreshNeeded');
    case 'INVALID_REMINDER_TIME':return t('reminderInvalid');
    case 'NOTIFICATIONS_DENIED':return t('reminderDenied');
    case 'NOTIFICATIONS_UNAVAILABLE':return t('reminderUnavailable');
    case 'NOTIFICATION_SCHEDULE_ERROR':return t('reminderScheduleError');
    case 'NOTIFICATION_STATE_ERROR':return t('reminderStateError');
    case 'NOTIFICATION_API_ERROR':return t('reminderApiError');
    case 'INSUFFICIENT_POINTS':return t('insufficientPoints');
    case 'OUT_OF_STOCK':return t('outOfStock');
    case 'REWARDS_REFRESH_REQUIRED':return t('rewardRefreshNeeded');
    case 'PENDING_REWARD':case 'IDEMPOTENCY_CONFLICT':return t('rewardPendingBody');
    case 'NO_PENDING_REWARD':return t('noPendingReward');
    case 'NOT_FOUND':return t('rewardNotFound');
    case 'INVALID_INPUT':return t('invalidData');
    case 'INVALID_RESPONSE':case 'LOCAL_STATE_ERROR':case 'FORBIDDEN':return t('accessBlockedBody');
    case 'RATE_LIMITED':return t('rateLimited');
    case 'REWARDS_PAUSED':case 'REWARDS_DISABLED':return t('rewardsPaused');
    case 'CUTOFF_PASSED':case 'CUTOFF_EXCEEDED':case 'SYNC_CUTOFF_PASSED':return t('cutoffPassed');
    case 'SOURCE_PINNED':case 'SOURCE_PIN_MISMATCH':return t('sourcePinned');
    case 'CONSENT_REQUIRED':return t('syncDisabled');
    case 'RECONNECT_REQUIRED':case 'SYNC_PAUSED':return t('reconnectRequired');
    case 'PENDING_SYNC':return t('retryPending');
    case 'NO_DATA':return t('noData');
    case 'ADULT_REQUIRED':return t('adultNeeded');
    case 'TIMEOUT':case 'NETWORK_ERROR':return t('noNetwork');
    case 'REAUTHENTICATION_REQUIRED':return t('reauthRequired');
    case 'SESSION_UNAVAILABLE':case 'UNAUTHENTICATED':case 'ACCOUNT_INACTIVE':return t('sessionExpired');
    default:return fallback;
  }
}
