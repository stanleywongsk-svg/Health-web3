import { t } from '../i18n';
export function errorMessage(error:unknown,fallback:string):string {
  const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  switch(code){
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
